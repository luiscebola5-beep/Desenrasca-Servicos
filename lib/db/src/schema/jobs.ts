import { date, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const jobsTable = pgTable("jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ownerId: text("owner_id").notNull().references(() => profilesTable.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  budget: real("budget").notNull(),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobsTable.$inferSelect;
