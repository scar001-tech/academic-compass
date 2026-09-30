/**
 * One-time migration: copy the local SQLite database into Postgres.
 *
 * The API server can run on either backend (see createStore in src/lib/store.ts),
 * but a fresh Postgres database starts empty, so deploying with DATABASE_URL
 * without running this first would silently drop every account and mark.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node --experimental-strip-types \
 *     scripts/migrate-sqlite-to-postgres.ts [--sqlite <path>] [--dry-run] [--force]
 *
 * Safety:
 *   - Refuses to run if the target already holds profiles, unless --force.
 *   - Runs the whole copy inside a single transaction.
 *   - Re-checks row counts per table afterwards and reports any mismatch.
 *
 * Stop the API server before running this so the SQLite file is not being
 * written while it is read.
 */
import { DatabaseSync } from "node:sqlite";
import { POSTGRES_SCHEMA } from "../src/lib/postgresSchema.ts";

type Column = { name: string; toBoolean?: boolean };

type TableSpec = {
  table: string;
  columns: Column[];
};

const TABLES: TableSpec[] = [
  {
    table: "ac_profiles",
    columns: [
      { name: "id" },
      { name: "email" },
      { name: "password_hash" },
      { name: "full_name" },
      { name: "department" },
      { name: "approved", toBoolean: true },
      { name: "created_at" },
    ],
  },
  { table: "ac_user_roles", columns: [{ name: "user_id" }, { name: "role" }] },
  {
    table: "ac_mark_entries",
    columns: [
      { name: "id" },
      { name: "curriculum_id" },
      { name: "sheet_id" },
      { name: "student_id" },
      { name: "score" },
      { name: "updated_by" },
      { name: "device_name" },
      { name: "version" },
      { name: "updated_at" },
    ],
  },
  {
    table: "ac_timetable_slots",
    columns: [
      { name: "id" },
      { name: "curriculum_id" },
      { name: "class_id" },
      { name: "stream_id" },
      { name: "day_of_week" },
      { name: "period" },
      { name: "start_time" },
      { name: "end_time" },
      { name: "subject_id" },
      { name: "teacher_id" },
      { name: "room" },
      { name: "version" },
      { name: "updated_by" },
      { name: "device_name" },
      { name: "updated_at" },
    ],
  },
  {
    table: "ac_sync_conflicts",
    columns: [
      { name: "id" },
      { name: "entity" },
      { name: "entity_id" },
      { name: "field" },
      { name: "server_value" },
      { name: "incoming_value" },
      { name: "incoming_by" },
      { name: "incoming_device" },
      { name: "status" },
      { name: "resolution" },
      { name: "custom_value" },
      { name: "created_at" },
      { name: "resolved_at" },
    ],
  },
  {
    table: "ac_school_data",
    columns: [{ name: "id" }, { name: "data" }, { name: "updated_at" }],
  },
  {
    table: "ac_sms_logs",
    columns: [
      { name: "id" },
      { name: "student_id" },
      { name: "admission_no" },
      { name: "student_name" },
      { name: "parent_number" },
      { name: "exam_id" },
      { name: "exam_name" },
      { name: "provider" },
      { name: "status" },
      { name: "message_id" },
      { name: "error" },
      { name: "sent_at" },
    ],
  },
];

const BATCH = 500;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const hasFlag = (name: string) => process.argv.includes(name);

function countOf(db: DatabaseSync, table: string): number {
  try {
    return Number(
      (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as any).c,
    );
  } catch {
    return 0;
  }
}

const sqlitePath = arg("--sqlite") ?? "./data/academic-compass.sqlite";
const dryRun = hasFlag("--dry-run");
const force = hasFlag("--force");

const sqlite = new DatabaseSync(sqlitePath);

// Always report what is actually in the source, even before anything else.
const sourceCounts = TABLES.map((t) => ({
  table: t.table,
  rows: countOf(sqlite, t.table),
}));

console.log(`SQLite source: ${sqlitePath}`);
for (const { table, rows } of sourceCounts) {
  console.log(`  ${table.padEnd(20)} ${String(rows).padStart(7)}`);
}
const total = sourceCounts.reduce((n, r) => n + r.rows, 0);
console.log(`  ${"TOTAL".padEnd(20)} ${String(total).padStart(7)}`);

if (total === 0) {
  console.error("\nSource database is empty; nothing to migrate.");
  process.exit(1);
}

if (dryRun) {
  console.log("\n--dry-run: no changes made.");
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("\nDATABASE_URL is not set. Nothing was written.");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  console.error(
    "\nDATABASE_URL must be a postgres:// or postgresql:// URL. Nothing was written.",
  );
  process.exit(1);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(POSTGRES_SCHEMA);
  console.log("\nschema ensured");

  const existing = await pool.query("SELECT COUNT(*)::int AS c FROM ac_profiles");
  const existingCount = existing.rows[0].c;
  if (existingCount > 0 && !force) {
    console.error(
      `\nTarget already has ${existingCount} profile(s). Refusing to overwrite. ` +
        `Re-run with --force if that is intended.`,
    );
    process.exit(1);
  }

  const client = await pool.connect();
  let copied = 0;
  try {
    await client.query("BEGIN");

    for (const { table, columns } of TABLES) {
      const colNames = columns.map((c) => c.name);
      const rows = sqlite
        .prepare(`SELECT ${colNames.join(", ")} FROM ${table}`)
        .all() as any[];

      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const values: unknown[] = [];
        const tuples = slice.map((row) => {
          const placeholders = columns.map((c) => {
            let v = row[c.name];
            if (c.toBoolean) v = Boolean(Number(v));
            values.push(v === undefined ? null : v);
            return `$${values.length}`;
          });
          return `(${placeholders.join(", ")})`;
        });
        await client.query(
          `INSERT INTO ${table} (${colNames.join(", ")}) VALUES ${tuples.join(", ")}`,
          values,
        );
      }
      copied += rows.length;
      console.log(`  copied ${table.padEnd(20)} ${String(rows.length).padStart(7)}`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Verify every table landed completely.
  console.log("\nverification (source -> target)");
  let failed = false;
  for (const { table, rows } of sourceCounts) {
    const res = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    const target = res.rows[0].c;
    const ok = target === rows;
    if (!ok) failed = true;
    console.log(
      `  ${table.padEnd(20)} ${String(rows).padStart(7)} -> ${String(target).padStart(7)} ${ok ? "ok" : "MISMATCH"}`,
    );
  }

  console.log(`\ntotal rows copied: ${copied}`);
  if (failed) {
    console.error("\nverification failed: target counts differ from source.");
    process.exit(1);
  }
  console.log("migration complete");
} catch (err) {
  console.error("\nmigration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
  sqlite.close();
}
