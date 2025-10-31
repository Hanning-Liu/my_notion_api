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

export const googleOAuthTokens = sqliteTable("google_oauth_tokens", {
  userId: text("user_id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiryDate: int("expiry_date", { mode: 'timestamp_ms' }).notNull(), // Stored as milliseconds
  refreshTokenExpiry: int("refresh_token_expiry", { mode: 'timestamp_ms' }).notNull(),
  scope: text("scope").notNull(),
  tokenType: text("token_type").notNull(),
  createdAt: int("created_at", { mode: 'timestamp_ms' }).notNull(),
  updatedAt: int("updated_at", { mode: 'timestamp_ms' }).notNull()
});