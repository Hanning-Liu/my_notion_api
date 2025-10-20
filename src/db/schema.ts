import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const eventsTable = sqliteTable("events", {
  id: text("id").primaryKey(), // UUID as string
  title: text("title").notNull(),
  startDate: text("start_date").notNull(), // Storing as ISO string
  endDate: text("end_date").notNull(), // Storing as ISO string
  timeZone: text("time_zone"), // Nullable
  lastEditedTime: text("last_edited_time").notNull(), // ISO string
  googleEventId: text("google_event_id") // Nullable
});
