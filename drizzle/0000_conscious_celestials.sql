CREATE TABLE `prep_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`company` text NOT NULL,
	`job_title` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prep_packs_user_created_idx` ON `prep_packs` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`user_email` text NOT NULL,
	`usage_date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_email`, `usage_date`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_workspaces` (
	`user_email` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`document_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
