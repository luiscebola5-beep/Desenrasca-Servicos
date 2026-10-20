import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";
import { profilesTable } from "./profiles";

export const messagesTable = pgTable("application_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => profilesTable.userId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messagesTable.$inferSelect;
