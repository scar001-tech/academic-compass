/**
 * Postgres schema, mirroring the SQLite tables created in createSqliteStore.
 *
 * Table names, column names and timestamp handling (ISO-8601 TEXT, which is
 * what the app writes and reads back) must stay identical between the two
 * backends. This module is the single source of truth for the Postgres DDL and
 * is shared by the runtime store and the SQLite to Postgres migration script.
 */
export const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ac_profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    department TEXT,
    approved BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL DEFAULT ''
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
    score DOUBLE PRECISION,
    updated_by TEXT,
    device_name TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT ''
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
    updated_at TEXT NOT NULL DEFAULT ''
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
    created_at TEXT NOT NULL DEFAULT '',
    resolved_at TEXT,
    UNIQUE (entity, entity_id, field, status)
  );
  CREATE TABLE IF NOT EXISTS ac_school_data (
    id TEXT PRIMARY KEY DEFAULT 'global',
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS ac_sms_logs (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    admission_no TEXT NOT NULL,
    student_name TEXT NOT NULL,
    parent_number TEXT NOT NULL,
    exam_id TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    message_id TEXT,
    error TEXT,
    sent_at TEXT NOT NULL DEFAULT ''
  );
`;
