import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState, CurriculumId, ID, SyncConflict, TimetableSlot,
  loadState, saveState, resetState,
} from "@/lib/schoolData";
import {
  pushMarkEntry, pushMarkEntries, fetchAllMarkEntries, fetchAllTimetableSlots,
  fetchPendingConflicts, resolveRemoteConflict,
  pushTimetableSlot, pushTimetableSlots, deleteTimetableSlot,
  RemoteTimetableSlot, RemoteMarkEntry, RemoteConflict,
  pushSchoolSnapshot, fetchSchoolSnapshot,
} from "@/lib/syncService";
import { toast } from "sonner";

interface SchoolCtx {
  state: AppState;
  activeCurriculum: CurriculumId;
  setActiveCurriculum: (c: CurriculumId) => void;
  update: (updater: (s: AppState) => void) => void;
  setOnline: (v: boolean) => void;
  syncNow: () => Promise<{ pushed: number; conflicted: number } | null>;
  syncing: boolean;
  resetAll: () => void;
  setMarkScore: (entryId: ID, score: number | null) => void;
  resolveConflict: (id: ID, resolution: SyncConflict["resolution"], custom?: string) => Promise<void>;
  bulkResolveConflicts: (resolution: SyncConflict["resolution"]) => Promise<void>;
  upsertTimetableSlot: (slot: TimetableSlot) => void;
  removeTimetableSlot: (id: ID) => void;
}

const Ctx = createContext<SchoolCtx | null>(null);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [state, setState]   = useState<AppState>(() => loadState());
  const [syncing, setSyncing] = useState(false);
  const [activeCurriculum, setActiveCurriculum] = useState<CurriculumId>(() => {
    return (localStorage.getItem("scholaris_active") as CurriculumId) || "cbc";
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const lastSnapshotRef = useRef<{ hash: string; ts: number } | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => { localStorage.setItem("scholaris_active", activeCurriculum); }, [activeCurriculum]);

  const update = useCallback((updater: (s: AppState) => void) => {
    setState((prev) => {
      const next: AppState = structuredClone(prev);
      updater(next);
      stateRef.current = next;
      return next;
    });
  }, []);

  // Track real network connectivity — no manual override
  useEffect(() => {
    const on  = () => update((s) => { s.online = true; });
    const off = () => update((s) => { s.online = false; });
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    update((s) => { s.online = navigator.onLine; });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [update]);

  // setOnline kept for API compatibility but does nothing UI-side
  const setOnline = useCallback((_v: boolean) => {}, []);

  const syncNow = useCallback(async (): Promise<{ pushed: number; conflicted: number } | null> => {
    if (syncing) return null;
    if (!localStorage.getItem("ac_token")) return null;
    setSyncing(true);
    try {
      const s = stateRef.current;

      const pending = s.entries.filter(e => e.pending);
      const pendingSlots = (s.timetable ?? []).filter(sl => sl.pending);

      const snapshotPayload = JSON.stringify({
        students: s.students.length,
        teachers: s.teachers.length,
        classes: s.classes.length,
        streams: s.streams.length,
        subjects: s.subjects.length,
        exams: s.exams.length,
        sheets: s.sheets.length,
        classRemarks: s.classRemarks.length,
        principalRemarks: s.principalRemarks.length,
        settings: s.settings.schoolName,
        deletedIds: s.deletedIds?.length ?? 0,
      });
      const skipSnapshot = lastSnapshotRef.current?.hash === snapshotPayload;

      const snapshotPromise = skipSnapshot
        ? Promise.resolve("skipped" as const)
        : pushSchoolSnapshot({
            students: s.students,
            teachers: s.teachers,
            classes: s.classes,
            streams: s.streams,
            subjects: s.subjects,
            exams: s.exams,
            sheets: s.sheets,
            curricula: s.curricula,
            settings: s.settings,
            classRemarks: s.classRemarks,
            principalRemarks: s.principalRemarks,
            deletedIds: s.deletedIds ?? [],
          });

      const markPromise =
        pending.length > 0
          ? pushMarkEntries(
              pending.map((e) => ({
                id: e.id,
                curriculumId: s.sheets.find((sh) => sh.id === e.sheetId)?.curriculumId ?? "cbc",
                sheetId: e.sheetId,
                studentId: e.studentId,
                score: e.score,
                version: e.version ?? 1,
                deviceName: s.deviceName,
              }))
            )
          : Promise.resolve([]);

      const slotPromise =
        pendingSlots.length > 0
          ? pushTimetableSlots(
              pendingSlots.map((sl) => ({
                id: sl.id,
                curriculum_id: sl.curriculumId,
                class_id: sl.classId,
                stream_id: sl.streamId ?? null,
                day_of_week: sl.dayOfWeek,
                period: sl.period,
                start_time: sl.startTime ?? null,
                end_time: sl.endTime ?? null,
                subject_id: sl.subjectId ?? null,
                teacher_id: sl.teacherId ?? null,
                room: sl.room ?? null,
                version: sl.version ?? 1,
                updated_by: null,
                device_name: s.deviceName,
                updated_at: new Date().toISOString(),
              }))
            )
          : Promise.resolve([]);

      const [snapshotStatus, markResults, _slotResults] = await Promise.all([
        snapshotPromise,
        markPromise,
        slotPromise,
      ]);

      if (!skipSnapshot && snapshotStatus === "ok") {
        lastSnapshotRef.current = { hash: snapshotPayload, ts: Date.now() };
      }

      let pushed = 0,
        conflicted = 0;
      const markStatuses = Array.isArray(markResults) ? markResults : [];
      for (const r of markStatuses) {
        if (r.status === "ok") {
          pushed++;
        } else if (r.status === "conflict") {
          conflicted++;
        }
      }

      if (pushed > 0 || conflicted > 0) {
        update((n) => {
          const syncedIds = new Set<string>();
          for (const r of markStatuses) {
            if (r.status === "ok") syncedIds.add(r.id);
          }
          for (const id of syncedIds) {
            const e = n.entries.find((x) => x.id === id);
            if (e) {
              e.pending = false;
              e.version = (e.version ?? 1) + 1;
            }
          }
          n.syncQueue = n.entries.filter((e) => e.pending).map((e) => e.id);
        });
      }

      const [remoteEntries, remoteSlots, remoteConflicts, remoteSnapshot] =
        await Promise.all([
          fetchAllMarkEntries(),
          fetchAllTimetableSlots(),
          fetchPendingConflicts(),
          fetchSchoolSnapshot(),
        ]);

      update((n) => {
        const localById = new Map(n.entries.map((e) => [e.id, e]));
        const mergedEntries = new Map<string, any>(localById);

        for (const r of remoteEntries as RemoteMarkEntry[]) {
          const existing = mergedEntries.get(r.id);
          if (!existing) {
            mergedEntries.set(r.id, {
              id: r.id,
              sheetId: r.sheet_id,
              studentId: r.student_id,
              score: r.score,
              updatedAt: new Date(r.updated_at).getTime(),
              updatedBy: r.device_name ?? "Cloud",
              version: r.version,
            });
          } else if (!existing.pending) {
            mergedEntries.set(r.id, {
              ...existing,
              score: r.score,
              version: r.version,
              updatedAt: new Date(r.updated_at).getTime(),
              updatedBy: r.device_name ?? "Cloud",
            });
          } else {
            mergedEntries.set(r.id, {
              ...existing,
              version: r.version,
              pending: false,
            });
          }
        }

        n.entries = Array.from(mergedEntries.values());
        n.syncQueue = n.entries.filter((e) => e.pending).map((e) => e.id);

        n.timetable = (remoteSlots as RemoteTimetableSlot[]).map((r) => ({
          id: r.id,
          curriculumId: r.curriculum_id as CurriculumId,
          classId: r.class_id,
          streamId: r.stream_id ?? undefined,
          dayOfWeek: r.day_of_week,
          period: r.period,
          startTime: r.start_time ?? undefined,
          endTime: r.end_time ?? undefined,
          subjectId: r.subject_id ?? undefined,
          teacherId: r.teacher_id ?? undefined,
          room: r.room ?? undefined,
          version: r.version,
          updatedAt: new Date(r.updated_at).getTime(),
          updatedBy: r.device_name ?? "Cloud",
          pending: false,
        }));
        const remoteIds = new Set(n.timetable.map((t) => t.id));
        (stateRef.current.timetable ?? []).forEach((local) => {
          if (local.pending && !remoteIds.has(local.id))
            n.timetable.push(local);
        });

        n.conflicts = remoteConflicts
          .filter((c: RemoteConflict) => c.status === "pending")
          .map((c: RemoteConflict) => ({
            id: c.id,
            entity: c.entity as SyncConflict["entity"],
            field: c.field,
            serverValue: c.server_value ?? "",
            thisDeviceValue: c.incoming_value ?? "",
            editedBy: c.incoming_by ?? "unknown",
            deviceName: c.incoming_device ?? "device",
            timestamp: new Date(c.created_at).getTime(),
            status: "pending" as const,
            ...(c.entity === "mark" ? decodeMarkEntity(n, c.entity_id) : {}),
            ...(c.entity === "timetable"
              ? { timetableSlotId: c.entity_id }
              : {}),
          }));

        n.syncQueue = n.entries.filter((e) => e.pending).map((e) => e.id);
        n.lastSyncAt = Date.now();
      });

      if (remoteSnapshot) {
        update((n) => {
          const arrays = [
            "students",
            "teachers",
            "classes",
            "streams",
            "subjects",
            "exams",
            "sheets",
            "classRemarks",
            "principalRemarks",
          ] as const;
          const deleted = new Set(
            (remoteSnapshot.deletedIds ?? []).map(String)
          );
          for (const key of arrays) {
            const src = (n[key] ?? []) as any[];
            const kept = src.filter((item) => !deleted.has(String(item.id)));
            const remoteArr = remoteSnapshot[key] ?? [];
            const map = new Map<string, any>();
            for (const item of [...kept, remoteArr]) {
              if (!item?.id) continue;
              const existing = map.get(item.id);
              if (
                !existing ||
                (item.updatedAt &&
                  (!existing.updatedAt || item.updatedAt > existing.updatedAt))
              ) {
                map.set(item.id, item);
              }
            }
            n[key] = Array.from(map.values()).sort((a: any, b: any) =>
              (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
            ) as any;
          }
          if (remoteSnapshot.curricula?.length) {
            n.curricula = remoteSnapshot.curricula;
          }
          if (remoteSnapshot.settings) {
            n.settings = { ...n.settings, ...remoteSnapshot.settings };
          }
          n.deletedIds = [];
        });
      }

      if (pushed)
        toast.success(`Synced ${pushed} change${pushed > 1 ? "s" : ""}`);
      if (conflicted)
        toast.warning(
          `${conflicted} conflict${conflicted > 1 ? "s" : ""} to resolve`
        );
      return { pushed, conflicted };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Sync failed: " + msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [update, syncing]);

  const debouncedSyncNow = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => { syncNow(); }, 150);
  }, [syncNow]);

  useEffect(() => {
    if (state.online) {
      const hasPending =
        state.entries.some(e => e.pending) ||
        (state.timetable ?? []).some(t => t.pending);
      if (hasPending) debouncedSyncNow();
    }
  }, [state.online, debouncedSyncNow]); // eslint-disable-line

  useEffect(() => {
    if (!localStorage.getItem("ac_token")) return;
    const onFocus = () => { if (navigator.onLine) debouncedSyncNow(); };
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => { if (navigator.onLine) debouncedSyncNow(); }, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [debouncedSyncNow]);

  useEffect(() => {
    if (localStorage.getItem("ac_token")) {
      syncNow();
    }
  }, []); // eslint-disable-line

  const setMarkScore = useCallback((entryId: ID, score: number | null) => {
    update((s) => {
      const e = s.entries.find(x => x.id === entryId);
      if (!e) return;
      e.score = score;
      e.updatedAt = Date.now();
      e.updatedBy = s.deviceName;
      e.pending = true;
      if (!s.syncQueue.includes(entryId)) s.syncQueue.push(entryId);
    });
    if (stateRef.current.online) syncNow();
  }, [update, syncNow]);

  const resolveConflict = useCallback(async (
    id: ID,
    resolution: SyncConflict["resolution"],
    custom?: string
  ) => {
    try {
      await resolveRemoteConflict(
        id,
        (resolution as string) === "other" ? "this" : (resolution as "server" | "this" | "custom"),
        custom
      );
      update((s) => {
        const c = s.conflicts.find(x => x.id === id);
        if (c) {
          c.status = "resolved";
          c.resolution = resolution;
          if (resolution === "custom") c.customValue = custom;
        }
      });
      syncNow();
    } catch (err) {
      console.error("[resolveConflict]", err);
      toast.error("Failed to resolve conflict");
    }
  }, [update, syncNow]);

  const bulkResolveConflicts = useCallback(async (resolution: SyncConflict["resolution"]) => {
    const pending = stateRef.current.conflicts.filter(c => c.status === "pending");
    try {
      for (const c of pending) {
        await resolveRemoteConflict(c.id, resolution as "server" | "this" | "custom");
      }
      update((s) => {
        s.conflicts.forEach(c => {
          if (c.status === "pending") { c.status = "resolved"; c.resolution = resolution; }
        });
      });
      syncNow();
    } catch (err) {
      console.error("[bulkResolveConflicts]", err);
      toast.error("Failed to resolve some conflicts");
    }
  }, [update, syncNow]);

  const upsertTimetableSlot = useCallback((slot: TimetableSlot) => {
    update((s) => {
      s.timetable = s.timetable ?? [];
      const i = s.timetable.findIndex(t => t.id === slot.id);
      const next = { ...slot, updatedAt: Date.now(), updatedBy: s.deviceName, pending: true };
      if (i >= 0) s.timetable[i] = { ...s.timetable[i], ...next };
      else s.timetable.push(next);
    });
    if (stateRef.current.online) syncNow();
  }, [update, syncNow]);

  const removeTimetableSlot = useCallback(async (id: ID) => {
    try {
      await deleteTimetableSlot(id);
      update((s) => { s.timetable = (s.timetable ?? []).filter(t => t.id !== id); });
    } catch (err) {
      console.error("[removeTimetableSlot]", err);
      toast.error("Failed to remove timetable slot");
    }
  }, [update]);

  const resetAll = useCallback(() => { setState(resetState()); }, []);

  const value = useMemo<SchoolCtx>(() => ({
    state, activeCurriculum, setActiveCurriculum, update, setOnline,
    syncNow, syncing, setMarkScore, resolveConflict, bulkResolveConflicts,
    resetAll, upsertTimetableSlot, removeTimetableSlot,
  }), [
    state, activeCurriculum, update, setOnline, syncNow, syncing,
    setMarkScore, resolveConflict, bulkResolveConflicts, resetAll,
    upsertTimetableSlot, removeTimetableSlot,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function decodeMarkEntity(state: AppState, entryId: ID) {
  const e = state.entries.find(x => x.id === entryId);
  if (!e) return {};
  const sheet = state.sheets.find(sh => sh.id === e.sheetId);
  return { studentId: e.studentId, subjectId: sheet?.subjectId, examId: sheet?.examId, markEntryId: entryId };
}

export function useSchool() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSchool must be used within SchoolProvider");
  return ctx;
}
