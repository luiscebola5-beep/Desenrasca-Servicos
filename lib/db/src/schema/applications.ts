import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const applicationsTable = pgTable("job_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  applicantId: text("applicant_id").notNull().references(() => profilesTable.userId, { onDelete: "cascade" }),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("job_applications_job_applicant_unique").on(table.jobId, table.applicantId),
]);

export type Application = typeof applicationsTable.$inferSelect;
