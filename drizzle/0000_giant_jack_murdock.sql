CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`time_zone` text,
	`last_edited_time` text NOT NULL,
	`google_event_id` text
);
