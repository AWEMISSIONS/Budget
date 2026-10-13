CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_month_category_idx` ON `budgets` (`month`,`category`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target` real NOT NULL,
	`saved` real DEFAULT 0 NOT NULL,
	`target_date` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`due_day` integer NOT NULL,
	`type` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`account` text NOT NULL,
	`fingerprint` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_idx` ON `transactions` (`fingerprint`);