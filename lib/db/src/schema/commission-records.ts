import { integer, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";

// Future bookkeeping only. The app does not charge users or process payments.
export const commissionRecordsTable = pgTable("commission_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  rateBasisPoints: integer("rate_basis_points"),
  amount: real("amount"),
  status: text("status").notNull().default("unconfigured"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("commission_records_job_unique").on(table.jobId),
]);
