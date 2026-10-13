CREATE TABLE `bill_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`recurring_id` integer NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`paid_date` text DEFAULT '' NOT NULL,
	`actual_amount` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_payments_month_recurring_idx` ON `bill_payments` (`month`,`recurring_id`);