CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`matrix_number` text NOT NULL,
	`class_group` text NOT NULL,
	`whatsapp` text NOT NULL,
	`slot` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_matrix_number_unique` ON `registrations` (`matrix_number`);