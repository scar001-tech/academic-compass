import { Router } from "express";
import { authenticateJWT } from "./auth";
import { getStore } from "../lib/store";

const router = Router();

router.get("/", authenticateJWT, async (_req, res) => {
  try {
    const snapshot = await (await getStore()).getSchoolSnapshot();
    return res.json(snapshot ? { data: JSON.parse(snapshot.data), updatedAt: snapshot.updatedAt } : { data: null, updatedAt: null });
  } catch (err) {
    console.error("[sync GET]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", authenticateJWT, async (req: any, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ message: "Invalid payload" });
    }
    const remoteSnapshot = await (await getStore()).getSchoolSnapshot();
    let remoteData: any = null;
    if (remoteSnapshot?.data) {
      try { remoteData = JSON.parse(remoteSnapshot.data); } catch {}
    }
    const merged = mergeSnapshots(remoteData, payload);
    await (await getStore()).setSchoolSnapshot(JSON.stringify(merged));
    return res.json({ data: merged, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[sync POST]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

function mergeSnapshots(remote: any, local: any): any {
  if (!remote) return local;
  if (!local) return remote;
  const deleted = new Set([...(remote.deletedIds ?? []), ...(local.deletedIds ?? [])].map(String));
  const merged = { ...remote, deletedIds: Array.from(deleted) };
  const arrays = ["students", "teachers", "classes", "streams", "subjects", "exams", "sheets", "classRemarks", "principalRemarks"];
  for (const key of arrays) {
    const remoteArr = Array.isArray(remote[key]) ? remote[key] : [];
    const localArr = Array.isArray(local[key]) ? local[key] : [];
    const map = new Map<string, any>();
    for (const item of [...remoteArr, ...localArr]) {
      if (!item?.id) continue;
      if (deleted.has(String(item.id))) continue;
      const existing = map.get(item.id);
      if (!existing || (item.updatedAt && (!existing.updatedAt || item.updatedAt > existing.updatedAt))) {
        map.set(item.id, item);
      }
    }
    merged[key] = Array.from(map.values()).sort((a: any, b: any) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
  }
  const scalarObjects = ["curricula", "settings"];
  for (const key of scalarObjects) {
    if (local[key] && (!remote[key] || (local[key].updatedAt ?? 0) > (remote[key]?.updatedAt ?? 0))) {
      merged[key] = local[key];
    }
  }
  if (local.settings) merged.settings = { ...remote.settings, ...local.settings };
  return merged;
}

export default router;
