import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("ac_profiles", {
  id: text("id").primaryKey().notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  department: text("department"),
  approved: integer("approved").default(0).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const userRoles = sqliteTable("ac_user_roles", {
  userId: text("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.role] })]);

export const markEntries = sqliteTable("ac_mark_entries", {
  id: text("id").primaryKey().notNull(),
  curriculumId: text("curriculum_id").notNull(),
  sheetId: text("sheet_id").notNull(),
  studentId: text("student_id").notNull(),
  score: real("score"),
  updatedBy: text("updated_by"),
  deviceName: text("device_name"),
  version: integer("version").default(1).notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const timetableSlots = sqliteTable("ac_timetable_slots", {
  id: text("id").primaryKey().notNull(),
  curriculumId: text("curriculum_id").notNull(),
  classId: text("class_id").notNull(),
  streamId: text("stream_id"),
  dayOfWeek: integer("day_of_week").notNull(),
  period: integer("period").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  subjectId: text("subject_id"),
  teacherId: text("teacher_id"),
  room: text("room"),
  version: integer("version").default(1).notNull(),
  updatedBy: text("updated_by"),
  deviceName: text("device_name"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const syncConflicts = sqliteTable("ac_sync_conflicts", {
  id: text("id").primaryKey().notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  field: text("field").notNull(),
  serverValue: text("server_value"),
  incomingValue: text("incoming_value"),
  incomingBy: text("incoming_by"),
  incomingDevice: text("incoming_device"),
  status: text("status").default("pending").notNull(),
  resolution: text("resolution"),
  customValue: text("custom_value"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  resolvedAt: text("resolved_at"),
});

export const schoolData = sqliteTable("ac_school_data", {
  id: text("id").primaryKey().notNull().default("global"),
  data: text("data").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});
