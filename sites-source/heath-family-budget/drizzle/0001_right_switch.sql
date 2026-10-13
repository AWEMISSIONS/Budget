CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`checking` real DEFAULT 0 NOT NULL,
	`savings` real DEFAULT 0 NOT NULL,
	`snapshot_date` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`balance` real NOT NULL,
	`apr` real DEFAULT 0 NOT NULL,
	`due_day` integer NOT NULL,
	`min_payment` real DEFAULT 0 NOT NULL,
	`source_updated` text DEFAULT '' NOT NULL
);
