DROP INDEX `stage_summaries_session_stage_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `stage_summaries_session_stage_idx` ON `stage_summaries` (`session_id`,`stage`);