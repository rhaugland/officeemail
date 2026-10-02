import { pgTable, uuid, text, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";

export const contactStatusEnum = pgEnum("contact_status", [
  "new",
  "approved",
  "rejected",
  "enrolled",
  "replied",
  "opted_out",
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  title: text("title").notNull(),
  companyName: text("company_name").notNull(),
  companySize: integer("company_size"),
  companyLocation: text("company_location"),
  industry: text("industry"),
  status: contactStatusEnum("status").default("new").notNull(),
  apolloId: text("apollo_id"),
  currentPhaseId: uuid("current_phase_id"),
  enrolledAt: timestamp("enrolled_at"),
  repliedAt: timestamp("replied_at"),
  optedOutAt: timestamp("opted_out_at"),
  lastReadAt: timestamp("last_read_at"),
  openCount: integer("open_count").default(0).notNull(),
  lastOpenedAt: timestamp("last_opened_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const phases = pgTable("phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceId: uuid("sequence_id").notNull(),
  phaseNumber: integer("phase_number").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  delayDays: integer("delay_days").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sequences = pgTable("sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  dailyLimit: integer("daily_limit").default(50).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sends = pgTable("sends", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").notNull(),
  phaseId: uuid("phase_id").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  resendId: text("resend_id"),
});

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").notNull(),
  direction: messageDirectionEnum("direction").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  resendId: text("resend_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
