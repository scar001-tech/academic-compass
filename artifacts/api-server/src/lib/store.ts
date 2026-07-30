import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type AppRole =
  | "admin"
  | "principal"
  | "hod"
  | "class_teacher"
  | "subject_teacher"
  | "teacher"
  | "senior_teacher";

export interface ProfileRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  department: string | null;
  approved: boolean;
  createdAt: Date;
}

export interface MarkEntryRow {
  id: string;
  curriculumId: string;
  sheetId: string;
  studentId: string;
  score: number | null;
  updatedBy: string | null;
  deviceName: string | null;
  version: number;
  updatedAt: Date;
}

export interface TimetableSlotRow {
  id: string;
  curriculumId: string;
  classId: string;
  streamId: string | null;
  dayOfWeek: number;
  period: number;
  startTime: string | null;
  endTime: string | null;
  subjectId: string | null;
  teacherId: string | null;
  room: string | null;
  version: number;
  updatedBy: string | null;
  deviceName: string | null;
  updatedAt: Date;
}

export interface SyncConflictRow {
  id: string;
  entity: string;
  entityId: string;
  field: string;
  serverValue: string | null;
  incomingValue: string | null;
  incomingBy: string | null;
  incomingDevice: string | null;
  status: string;
  resolution: string | null;
  customValue: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

interface DataStore {
  getProfileByEmail(email: string): Promise<ProfileRow | null>;
  getProfileById(id: string): Promise<ProfileRow | null>;
  hasAnyProfile(): Promise<boolean>;
  createProfile(input: {
    id: string;
    email: string;
    passwordHash: string;
    fullName?: string | null;
    department?: string | null;
    approved: boolean;
    roles?: AppRole[];
  }): Promise<void>;
  rolesForUser(userId: string): Promise<string[]>;
  hasAnyRole(userId: string, roles: readonly string[]): Promise<boolean>;
  listProfiles(): Promise<Array<ProfileRow & { roles: string[] }>>;
  setApproval(userId: string, approved: boolean): Promise<void>;
  assignRole(userId: string, role: AppRole, action: "add" | "remove"): Promise<void>;
  deleteProfile(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  listMarkEntries(): Promise<MarkEntryRow[]>;
  upsertMarkEntries(inputs: Array<{
    id: string;
    curriculumId: string;
    sheetId: string;
    studentId: string;
    score: number | null;
    version?: number;
    userId: string;
    deviceName?: string | null;
  }>): Promise<Array<{ id: string; status: "ok" | "conflict" | "error" }>>;
  upsertMarkEntry(input: {
    id: string;
    curriculumId: string;
    sheetId: string;
    studentId: string;
    score: number | null;
    version?: number;
    userId: string;
    deviceName?: string | null;
  }): Promise<"ok" | "conflict">;
  listTimetableSlots(): Promise<TimetableSlotRow[]>;
  upsertTimetableSlots(inputs: Array<{
    id: string;
    curriculumId: string;
    classId: string;
    streamId?: string | null;
    dayOfWeek: number;
    period: number;
    startTime?: string | null;
    endTime?: string | null;
    subjectId?: string | null;
    teacherId?: string | null;
    room?: string | null;
    version?: number;
    userId: string;
    deviceName?: string | null;
  }>): Promise<Array<{ id: string; status: "ok" | "conflict" | "error" }>>;
  upsertTimetableSlot(input: {
    id: string;
    curriculumId: string;
    classId: string;
    streamId?: string | null;
    dayOfWeek: number;
    period: number;
    startTime?: string | null;
    endTime?: string | null;
    subjectId?: string | null;
    teacherId?: string | null;
    room?: string | null;
    version?: number;
    userId: string;
    deviceName?: string | null;
  }): Promise<"ok" | "conflict">;
  deleteTimetableSlot(id: string): Promise<void>;
  listConflicts(status?: "pending" | "resolved"): Promise<SyncConflictRow[]>;
  resolveConflict(id: string, resolution: string | null, customValue?: string | null): Promise<void>;
  getSchoolSnapshot(): Promise<{ id: string; data: string; updatedAt: string } | null>;
  setSchoolSnapshot(data: string): Promise<void>;
}

let storePromise: Promise<DataStore> | null = null;

export function getStore() {
  storePromise ??= createStore();
  return storePromise;
}

async function createStore(): Promise<DataStore> {
  return createSqliteStore("./data/academic-compass.sqlite");
}

type Row = Record<string, unknown>;
type Result = { changes: number } & Row;

function runResult(sqliteDb: DatabaseSync, sql: string, ...args: any[]): Result {
  const res = (sqliteDb as any).prepare(sql).run(...args);
  return { changes: res.changes ?? 0, ...res } as Result;
}

async function createSqliteStore(rawPath: string): Promise<DataStore> {
  const sqlite = await import("node:sqlite") as unknown as { DatabaseSync: typeof DatabaseSync };
  const dbPath = path.resolve(process.cwd(), rawPath || "./data/academic-compass.sqlite");
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqliteDb = new sqlite.DatabaseSync(dbPath);
  sqliteDb.exec("PRAGMA journal_mode = WAL");
  sqliteDb.exec("PRAGMA foreign_keys = ON");
  sqliteDb.exec("PRAGMA busy_timeout = 5000");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS ac_profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      department TEXT,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ac_user_roles (
      user_id TEXT NOT NULL REFERENCES ac_profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      PRIMARY KEY (user_id, role)
    );
    CREATE TABLE IF NOT EXISTS ac_mark_entries (
      id TEXT PRIMARY KEY,
      curriculum_id TEXT NOT NULL,
      sheet_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      score REAL,
      updated_by TEXT,
      device_name TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ac_timetable_slots (
      id TEXT PRIMARY KEY,
      curriculum_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      stream_id TEXT,
      day_of_week INTEGER NOT NULL,
      period INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      subject_id TEXT,
      teacher_id TEXT,
      room TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT,
      device_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ac_sync_conflicts (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field TEXT NOT NULL,
      server_value TEXT,
      incoming_value TEXT,
      incoming_by TEXT,
      incoming_device TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      resolution TEXT,
      custom_value TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      UNIQUE(entity, entity_id, field, status)
    );
    CREATE TABLE IF NOT EXISTS ac_school_data (
      id TEXT PRIMARY KEY DEFAULT 'global',
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const profileFromRow = (row: any): ProfileRow => ({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    department: row.department,
    approved: Boolean(row.approved),
    createdAt: new Date(row.created_at),
  });
  const markFromRow = (row: any): MarkEntryRow => ({
    id: row.id,
    curriculumId: row.curriculum_id,
    sheetId: row.sheet_id,
    studentId: row.student_id,
    score: row.score,
    updatedBy: row.updated_by,
    deviceName: row.device_name,
    version: row.version,
    updatedAt: new Date(row.updated_at),
  });
  const slotFromRow = (row: any): TimetableSlotRow => ({
    id: row.id,
    curriculumId: row.curriculum_id,
    classId: row.class_id,
    streamId: row.stream_id,
    dayOfWeek: row.day_of_week,
    period: row.period,
    startTime: row.start_time,
    endTime: row.end_time,
    subjectId: row.subject_id,
    teacherId: row.teacher_id,
    room: row.room,
    version: row.version,
    updatedBy: row.updated_by,
    deviceName: row.device_name,
    updatedAt: new Date(row.updated_at),
  });
  const conflictFromRow = (row: any): SyncConflictRow => ({
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    field: row.field,
    serverValue: row.server_value,
    incomingValue: row.incoming_value,
    incomingBy: row.incoming_by,
    incomingDevice: row.incoming_device,
    status: row.status,
    resolution: row.resolution,
    customValue: row.custom_value,
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  });

  function withTransaction(fn: () => void) {
    sqliteDb.exec("BEGIN IMMEDIATE");
    try {
      fn();
      sqliteDb.exec("COMMIT");
    } catch (err) {
      sqliteDb.exec("ROLLBACK");
      throw err;
    }
  }

  return {
    async getProfileByEmail(email) {
      const row = (sqliteDb as any).prepare("SELECT * FROM ac_profiles WHERE email = ? LIMIT 1").get(email);
      return row ? profileFromRow(row) : null;
    },
    async getProfileById(id) {
      const row = (sqliteDb as any).prepare("SELECT * FROM ac_profiles WHERE id = ? LIMIT 1").get(id);
      return row ? profileFromRow(row) : null;
    },
    async hasAnyProfile() {
      return Boolean((sqliteDb as any).prepare("SELECT id FROM ac_profiles LIMIT 1").get());
    },
    async createProfile(input) {
      withTransaction(() => {
        runResult(sqliteDb as any, `INSERT INTO ac_profiles (id, email, password_hash, full_name, department, approved, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, input.id, input.email, input.passwordHash, input.fullName ?? null, input.department ?? null, input.approved ? 1 : 0, new Date().toISOString());
        const roleInsert = (sqliteDb as any).prepare("INSERT OR IGNORE INTO ac_user_roles (user_id, role) VALUES (?, ?)");
        for (const role of input.roles ?? []) roleInsert.run(input.id, role);
      });
    },
    async rolesForUser(userId) {
      return (sqliteDb as any).prepare("SELECT role FROM ac_user_roles WHERE user_id = ?").all(userId).map((row: any) => row.role);
    },
    async hasAnyRole(userId, roles) {
      const assigned = (sqliteDb as any).prepare("SELECT role FROM ac_user_roles WHERE user_id = ?").all(userId).map((row: any) => row.role as string);
      return assigned.some((role: string) => roles.includes(role));
    },
    async listProfiles() {
      const profiles = (sqliteDb as any).prepare("SELECT * FROM ac_profiles ORDER BY created_at ASC").all().map(profileFromRow);
      const roles = (sqliteDb as any).prepare("SELECT user_id, role FROM ac_user_roles").all();
      return profiles.map((profile: ProfileRow) => ({
        ...profile,
        roles: roles.filter((role: any) => role.user_id === profile.id).map((role: any) => role.role),
      }));
    },
    async setApproval(userId, approved) {
      runResult(sqliteDb as any, "UPDATE ac_profiles SET approved = ? WHERE id = ?", approved ? 1 : 0, userId);
    },
    async assignRole(userId, role, action) {
      if (action === "add") runResult(sqliteDb as any, "INSERT OR IGNORE INTO ac_user_roles (user_id, role) VALUES (?, ?)", userId, role);
      else runResult(sqliteDb as any, "DELETE FROM ac_user_roles WHERE user_id = ? AND role = ?", userId, role);
    },
    async deleteProfile(userId) {
      withTransaction(() => {
        runResult(sqliteDb as any, "DELETE FROM ac_user_roles WHERE user_id = ?", userId);
        runResult(sqliteDb as any, "DELETE FROM ac_profiles WHERE id = ?", userId);
      });
    },
    async updatePassword(userId, passwordHash) {
      runResult(sqliteDb as any, "UPDATE ac_profiles SET password_hash = ? WHERE id = ?", passwordHash, userId);
    },
    async listMarkEntries() {
      return (sqliteDb as any).prepare("SELECT * FROM ac_mark_entries").all().map(markFromRow);
    },
    async upsertMarkEntry(input) {
      const newVersion = (input.version ?? 0) + 1;
      const updated = runResult(sqliteDb as any, `UPDATE ac_mark_entries SET score = ?, updated_by = ?, device_name = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?`, input.score, input.userId, input.deviceName ?? null, newVersion, new Date().toISOString(), input.id, input.version ?? 0);
      if (updated.changes > 0) return "ok";

      const insertResult = runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_mark_entries (id, curriculum_id, sheet_id, student_id, score, updated_by, device_name, version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.id, input.curriculumId, input.sheetId, input.studentId, input.score, input.userId, input.deviceName ?? null, 1, new Date().toISOString());
      if (insertResult.changes > 0) return "ok";

      const existing = (sqliteDb as any).prepare("SELECT * FROM ac_mark_entries WHERE id = ? LIMIT 1").get(input.id) as any;
      const alreadyConflicted = (sqliteDb as any).prepare("SELECT id FROM ac_sync_conflicts WHERE entity = ? AND entity_id = ? AND field = ? AND status = 'pending' LIMIT 1").get("mark", input.id, "score");
      if (!alreadyConflicted) {
        runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_sync_conflicts
          (id, entity, entity_id, field, server_value, incoming_value, incoming_by, incoming_device, status, created_at)
          VALUES (?, 'mark', ?, 'score', ?, ?, ?, ?, 'pending', ?)`, randomUUID(), input.id, String(existing.score ?? ""), String(input.score ?? ""), input.userId, input.deviceName ?? null, new Date().toISOString());
      }
      return "conflict";
    },
    async upsertMarkEntries(inputs) {
      const results: Array<{ id: string; status: "ok" | "conflict" | "error" }> = [];
      withTransaction(() => {
        for (const input of inputs) {
          const newVersion = (input.version ?? 0) + 1;
          const updated = runResult(sqliteDb as any, `UPDATE ac_mark_entries SET score = ?, updated_by = ?, device_name = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?`, input.score, input.userId, input.deviceName ?? null, newVersion, new Date().toISOString(), input.id, input.version ?? 0);
          if (updated.changes > 0) {
            results.push({ id: input.id, status: "ok" });
            continue;
          }
          const insertResult = runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_mark_entries (id, curriculum_id, sheet_id, student_id, score, updated_by, device_name, version, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.id, input.curriculumId, input.sheetId, input.studentId, input.score, input.userId, input.deviceName ?? null, 1, new Date().toISOString());
          if (insertResult.changes > 0) {
            results.push({ id: input.id, status: "ok" });
            continue;
          }
          const existing = (sqliteDb as any).prepare("SELECT * FROM ac_mark_entries WHERE id = ? LIMIT 1").get(input.id) as any;
          const alreadyConflicted = (sqliteDb as any).prepare("SELECT id FROM ac_sync_conflicts WHERE entity = ? AND entity_id = ? AND field = ? AND status = 'pending' LIMIT 1").get("mark", input.id, "score");
          if (!alreadyConflicted) {
            runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_sync_conflicts
              (id, entity, entity_id, field, server_value, incoming_value, incoming_by, incoming_device, status, created_at)
              VALUES (?, 'mark', ?, 'score', ?, ?, ?, ?, 'pending', ?)`, randomUUID(), input.id, String(existing.score ?? ""), String(input.score ?? ""), input.userId, input.deviceName ?? null, new Date().toISOString());
          }
          results.push({ id: input.id, status: "conflict" });
        }
      });
      return results;
    },
    async listTimetableSlots() {
      return (sqliteDb as any).prepare("SELECT * FROM ac_timetable_slots").all().map(slotFromRow);
    },
    async upsertTimetableSlot(input) {
      const newVersion = (input.version ?? 0) + 1;
      const updated = runResult(sqliteDb as any, `UPDATE ac_timetable_slots SET curriculum_id = ?, class_id = ?, stream_id = ?, day_of_week = ?, period = ?, start_time = ?, end_time = ?, subject_id = ?, teacher_id = ?, room = ?, version = ?, updated_by = ?, device_name = ?, updated_at = ? WHERE id = ? AND version = ?`, input.curriculumId, input.classId, input.streamId ?? null, input.dayOfWeek, input.period, input.startTime ?? null, input.endTime ?? null, input.subjectId ?? null, input.teacherId ?? null, input.room ?? null, newVersion, input.userId, input.deviceName ?? null, new Date().toISOString(), input.id, input.version ?? 0);
      if (updated.changes > 0) return "ok";

      const insertResult = runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_timetable_slots
        (id, curriculum_id, class_id, stream_id, day_of_week, period, start_time, end_time, subject_id, teacher_id, room, version, updated_by, device_name, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.id, input.curriculumId, input.classId, input.streamId ?? null, input.dayOfWeek, input.period, input.startTime ?? null, input.endTime ?? null, input.subjectId ?? null, input.teacherId ?? null, input.room ?? null, 1, input.userId, input.deviceName ?? null, new Date().toISOString());
      if (insertResult.changes > 0) return "ok";

      const existing = (sqliteDb as any).prepare("SELECT * FROM ac_timetable_slots WHERE id = ? LIMIT 1").get(input.id) as any;
      const alreadyConflicted = (sqliteDb as any).prepare("SELECT id FROM ac_sync_conflicts WHERE entity = ? AND entity_id = ? AND field = ? AND status = 'pending' LIMIT 1").get("timetable", input.id, "slot");
      if (!alreadyConflicted) {
        runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_sync_conflicts
          (id, entity, entity_id, field, server_value, incoming_value, incoming_by, incoming_device, status, created_at)
          VALUES (?, 'timetable', ?, 'slot', ?, ?, ?, ?, 'pending', ?)`, randomUUID(), input.id, `${existing.subject_id}@${existing.day_of_week}/${existing.period}`, `${input.subjectId}@${input.dayOfWeek}/${input.period}`, input.userId, input.deviceName ?? null, new Date().toISOString());
      }
      return "conflict";
    },
    async upsertTimetableSlots(inputs) {
      const results: Array<{ id: string; status: "ok" | "conflict" | "error" }> = [];
      withTransaction(() => {
        for (const input of inputs) {
          const newVersion = (input.version ?? 0) + 1;
          const updated = runResult(sqliteDb as any, `UPDATE ac_timetable_slots SET curriculum_id = ?, class_id = ?, stream_id = ?, day_of_week = ?, period = ?, start_time = ?, end_time = ?, subject_id = ?, teacher_id = ?, room = ?, version = ?, updated_by = ?, device_name = ?, updated_at = ? WHERE id = ? AND version = ?`, input.curriculumId, input.classId, input.streamId ?? null, input.dayOfWeek, input.period, input.startTime ?? null, input.endTime ?? null, input.subjectId ?? null, input.teacherId ?? null, input.room ?? null, newVersion, input.userId, input.deviceName ?? null, new Date().toISOString(), input.id, input.version ?? 0);
          if (updated.changes > 0) {
            results.push({ id: input.id, status: "ok" });
            continue;
          }
          const insertResult = runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_timetable_slots
            (id, curriculum_id, class_id, stream_id, day_of_week, period, start_time, end_time, subject_id, teacher_id, room, version, updated_by, device_name, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.id, input.curriculumId, input.classId, input.streamId ?? null, input.dayOfWeek, input.period, input.startTime ?? null, input.endTime ?? null, input.subjectId ?? null, input.teacherId ?? null, input.room ?? null, 1, input.userId, input.deviceName ?? null, new Date().toISOString());
          if (insertResult.changes > 0) {
            results.push({ id: input.id, status: "ok" });
            continue;
          }
          const existing = (sqliteDb as any).prepare("SELECT * FROM ac_timetable_slots WHERE id = ? LIMIT 1").get(input.id) as any;
          const alreadyConflicted = (sqliteDb as any).prepare("SELECT id FROM ac_sync_conflicts WHERE entity = ? AND entity_id = ? AND field = ? AND status = 'pending' LIMIT 1").get("timetable", input.id, "slot");
          if (!alreadyConflicted) {
            runResult(sqliteDb as any, `INSERT OR IGNORE INTO ac_sync_conflicts
              (id, entity, entity_id, field, server_value, incoming_value, incoming_by, incoming_device, status, created_at)
              VALUES (?, 'timetable', ?, 'slot', ?, ?, ?, ?, 'pending', ?)`, randomUUID(), input.id, `${existing.subject_id}@${existing.day_of_week}/${existing.period}`, `${input.subjectId}@${input.dayOfWeek}/${input.period}`, input.userId, input.deviceName ?? null, new Date().toISOString());
          }
          results.push({ id: input.id, status: "conflict" });
        }
      });
      return results;
    },
    async deleteTimetableSlot(id) {
      runResult(sqliteDb as any, "DELETE FROM ac_timetable_slots WHERE id = ?", id);
    },
    async listConflicts(status) {
      const rows = status
        ? (sqliteDb as any).prepare("SELECT * FROM ac_sync_conflicts WHERE status = ?").all(status)
        : (sqliteDb as any).prepare("SELECT * FROM ac_sync_conflicts").all();
      return rows.map(conflictFromRow);
    },
    async resolveConflict(id, resolution, customValue) {
      runResult(sqliteDb as any, "UPDATE ac_sync_conflicts SET status = 'resolved', resolution = ?, custom_value = ?, resolved_at = ? WHERE id = ?", resolution, customValue ?? null, new Date().toISOString(), id);
    },
    async getSchoolSnapshot() {
      const row = (sqliteDb as any).prepare("SELECT * FROM ac_school_data WHERE id = 'global' LIMIT 1").get() as any;
      return row ? { id: row.id, data: row.data, updatedAt: row.updated_at } : null;
    },
    async setSchoolSnapshot(data) {
      runResult(sqliteDb as any, "INSERT INTO ac_school_data (id, data, updated_at) VALUES ('global', ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", data, new Date().toISOString());
    },
  };
}
