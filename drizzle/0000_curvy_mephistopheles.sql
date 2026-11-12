CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`author` text NOT NULL,
	`email` text,
	`chapter` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`visibility` text DEFAULT 'book' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_user_question` ON `entries` (`user_id`,`question`);