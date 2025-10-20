import * as dotenv from 'dotenv';
dotenv.config();
import { Client } from '@notionhq/client';
import { google } from 'googleapis';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { eventsTable } from './db/schema';


// Define environment variable schema
const envSchema = z.object({
  NOTION_API_KEY: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REFRESH_TOKEN: z.string(),
  TURSO_DATABASE_URL: z.string(),
  TURSO_AUTH_TOKEN: z.string(),
  GOOGLE_CALENDAR_ID: z.string(),
  // Add individual datasource IDs
  DATASOURCE_ID_1: z.string().optional(),
  DATASOURCE_ID_2: z.string().optional(),
  DATASOURCE_ID_3: z.string().optional(),
  DATASOURCE_ID_4: z.string().optional(),
  DATASOURCE_ID_5: z.string().optional(),
  DATASOURCE_ID_6: z.string().optional(),
  DATASOURCE_ID_7: z.string().optional(),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);
console.log('✅ Environment variables validated');

// Initialize Notion client
const notion = new Client({
  auth: env.NOTION_API_KEY
});
console.log('✅ Notion client initialized');

// Set up Google Calendar API
console.log('Initializing Google OAuth2 client...');
const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: env.GOOGLE_REFRESH_TOKEN
});
console.log('✅ Google OAuth2 client set up');

const calendar = google.calendar({
  version: 'v3',
});
console.log('✅ Google Calendar client initialized');

// Initialize Turso database
console.log('Initializing Turso client...');
const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN
});
console.log('✅ Turso client initialized');

const db = drizzle({ client });
console.log('✅ Drizzle ORM initialized');

interface NotionEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  timeZone: string | null;
  lastEditedTime: string;
}

async function fetchNotionEvents(dataSourceId: string): Promise<NotionEvent[]> {
  let hasMore = true;
  let startCursor: string | undefined = undefined;
  const allResults: NotionEvent[] = [];

  const sort: { property: string; direction: 'ascending' | 'descending' } = {
    property: 'Date',
    direction: 'ascending'
  };


  while (hasMore) {
    const queryParams = {
      data_source_id: dataSourceId,
      sorts: [sort],
      page_size: 100,
    };

    // Add start_cursor only if defined
    if (startCursor) {
      Object.assign(queryParams, { start_cursor: startCursor });
    }

    const response = await notion.dataSources.query(queryParams);

    // Collect this batch of results
    for (const page of response.results) {
      // Type guard to ensure we have a PageObjectResponse
      if ('properties' in page && 'last_edited_time' in page) {
        const properties = page.properties;
        allResults.push({
          id: page.id,
          title: (properties.Name as any)?.title?.[0]?.plain_text || 'Untitled',
          startDate: (properties.Date as any)?.date?.start || '',
          endDate: (properties.Date as any)?.date?.end || '',
          timeZone: (properties.Date as any)?.date?.time_zone || null,
          lastEditedTime: page.last_edited_time,
        });
      }
    }

    // Check pagination flags
    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return allResults;
}

// Collect all defined datasource IDs
const notionDataSourceIds = [
  env.DATASOURCE_ID_1,
  env.DATASOURCE_ID_2,
  env.DATASOURCE_ID_3,
  env.DATASOURCE_ID_4,
  env.DATASOURCE_ID_5,
  env.DATASOURCE_ID_6,
  env.DATASOURCE_ID_7,
].filter((id): id is string => !!id); // Remove undefined values

export async function syncEvents() {
  // Fetch events from all data sources concurrently
  try {
    const notionEvents = await Promise.all(
      notionDataSourceIds.map(fetchNotionEvents)
    );
    // Flatten the array of events from multiple data sources
    const allNotionEvents = notionEvents.flat();

    console.log(allNotionEvents.length)
    // Get current cache from database
    const cachedEvents = await db.select().from(eventsTable);
    console.log(cachedEvents.length)
    // Handle new, updated, and deleted events
    for (const [i, event] of allNotionEvents.entries()) {
      console.log(`⏳ [${i + 1}/${allNotionEvents.length}] Creating event: ${event.title}`);
      const cached = cachedEvents.find(c => c.id === event.id);
      // 1. New event: Create Google Calendar event
      if (!cached) {
        const gEvent = await calendar.events.insert({
          auth: oauth2Client,
          calendarId: env.GOOGLE_CALENDAR_ID,
          requestBody: {
            summary: event.title,
            start: { dateTime: event.startDate, timeZone: event.timeZone || 'Asia/Shanghai' },
            end: { dateTime: event.endDate, timeZone: event.timeZone || 'Asia/Shanghai' },
          },
        });
        console.log(`✅ Google event created: ${event.title}`);
        await new Promise(res => setTimeout(res, 500)); // 0.5s delay
        await db.insert(eventsTable).values({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          timeZone: event.timeZone,
          lastEditedTime: event.lastEditedTime,
          googleEventId: gEvent.data.id || null
        });

        console.log(`🆕 Created Google event: ${event.title}`);
      }
      // 2. Updated event: Update Google Calendar event
      else if (cached.lastEditedTime !== event.lastEditedTime) {
        await calendar.events.update({
          auth: oauth2Client,
          calendarId: env.GOOGLE_CALENDAR_ID,
          eventId: cached.googleEventId || '',
          requestBody: {
            summary: event.title,
            start: { dateTime: event.startDate, timeZone: event.timeZone || 'Asia/Shanghai' },
            end: { dateTime: event.endDate, timeZone: event.timeZone || 'Asia/Shanghai' },
          },
        });

        await db.update(eventsTable)
          .set({
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            timeZone: event.timeZone,
            lastEditedTime: event.lastEditedTime
          })
          .where(eq(eventsTable.id, event.id));

        console.log(`✏️ Updated Google event: ${event.title}`);
      }
    }

    // Handle deleted events (events present in cache but not in Notion)
    for (const cachedEvent of cachedEvents) {
      const stillExistsInNotion = allNotionEvents.some(event => event.id === cachedEvent.id);

      if (!stillExistsInNotion && cachedEvent.googleEventId) {
        await calendar.events.delete({
          auth: oauth2Client,
          calendarId: env.GOOGLE_CALENDAR_ID,
          eventId: cachedEvent.googleEventId,
        });

        await db.delete(eventsTable)
          .where(eq(eventsTable.id, cachedEvent.id));

        console.log(`❌ Deleted Google event: ${cachedEvent.title}`);
      }
    }

    console.log('✅ Sync complete');
  } catch (error) {
    console.error('[syncEvents] Error during sync:', error);
    throw error;
  }


}

// // Run the sync
// syncEvents().catch(err => {
//   console.error('❌ Sync failed:', err);
//   process.exit(1);
// });