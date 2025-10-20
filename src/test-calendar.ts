// test-calendar.ts
import * as dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { z } from 'zod';

// Define environment variable schema
const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REFRESH_TOKEN: z.string(),
  GOOGLE_CALENDAR_ID: z.string(),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);
console.log('✅ Environment variables validated');

// Set up Google Calendar API
const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({ 
  refresh_token: env.GOOGLE_REFRESH_TOKEN 
});

const calendar = google.calendar({ 
  version: 'v3', 
  auth: oauth2Client 
});

async function testGoogleCalendar() {
  try {
    console.log('Starting Google Calendar API tests...');
    
    // Test 1: List upcoming events
    console.log('Testing event listing...');
    const listResponse = await calendar.events.list({
      calendarId: env.GOOGLE_CALENDAR_ID,
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = listResponse.data.items || [];
    console.log(`✅ Found ${events.length} upcoming events`);
    events.forEach(event => {
      console.log(`- ${event.summary} (${event.start?.dateTime || event.start?.date})`);
    });
    
    // Test 2: Create a test event
    console.log('Creating test event...');
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 1);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    const createResponse = await calendar.events.insert({
      calendarId: env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: 'Test Event from API',
        description: 'This is a test event created by the Google Calendar API',
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'Asia/Shanghai',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Shanghai',
        },
      },
    });
    
    console.log(`✅ Test event created: ${createResponse.data.htmlLink}`);
    console.log(`Event ID: ${createResponse.data.id}`);
    
    // Test 3: Update the test event
    console.log('Updating test event...');
    const updateResponse = await calendar.events.update({
      calendarId: env.GOOGLE_CALENDAR_ID,
      eventId: createResponse.data.id || '',
      requestBody: {
        ...createResponse.data,
        summary: 'Updated Test Event',
      },
    });
    
    console.log(`✅ Test event updated: ${updateResponse.data.summary}`);
    
    // Test 4: Delete the test event
    console.log('Deleting test event...');
    await calendar.events.delete({
      calendarId: env.GOOGLE_CALENDAR_ID,
      eventId: createResponse.data.id || '',
    });
    
    console.log('✅ Test event deleted');
    
    console.log('✅ All Google Calendar API tests passed');
  } catch (error) {
    console.error('❌ Google Calendar API test failed:', error);
    process.exit(1);
  }
}

testGoogleCalendar();