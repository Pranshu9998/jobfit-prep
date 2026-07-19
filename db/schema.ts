import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userWorkspaces = sqliteTable("user_workspaces", {
  userEmail: text("user_email").primaryKey().references(() => users.email, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const prepPacks = sqliteTable("prep_packs", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  company: text("company").notNull(),
  jobTitle: text("job_title").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => ({ userCreatedIndex: index("prep_packs_user_created_idx").on(table.userEmail, table.createdAt) }));

export const usageCounters = sqliteTable("usage_counters", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  usageDate: text("usage_date").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, table => ({ primary: primaryKey({ columns: [table.userEmail, table.usageDate] }) }));
