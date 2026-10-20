import { integer, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

// Prepared for a future ratings feature; no public rating or write flow exists yet.
export const ratingsTable = pgTable("user_ratings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => profilesTable.userId, { onDelete: "cascade" }),
  subjectId: text("subject_id").notNull().references(() => profilesTable.userId, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_ratings_job_author_unique").on(table.jobId, table.authorId),
]);
