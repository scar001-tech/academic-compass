import { useMemo, useState } from "react";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, Pencil, Trash2, Plus, CalendarDays, Search } from "lucide-react";
import { TimetableSlot } from "@/lib/schoolData";
import { toast } from "sonner";

const DAYS = ["Mon","Tue","Wed","Thu","Fri"];
const PERIODS = [1,2,3,4,5,6,7,8];

export default function Timetable() {
  const { state, activeCurriculum, upsertTimetableSlot, removeTimetableSlot } = useSchool();
  const { canEditTimetable } = useAuth();

  const classes = state.classes.filter(c => c.curriculumId === activeCurriculum);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const streams = state.streams.filter(s => s.classId === classId);
  const [streamId, setStreamId] = useState<string>("");

  const slots = useMemo(() => (state.timetable ?? []).filter(t =>
    t.classId === classId && (streamId ? t.streamId === streamId : true)
  ), [state.timetable, classId, streamId]);

  const [editing, setEditing] = useState<TimetableSlot | null>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSlots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return slots;
    return slots.filter(slot => {
      const subject = state.subjects.find(x => x.id === slot.subjectId);
      const teacher = state.teachers.find(x => x.id === slot.teacherId);
      return (subject?.name || "").toLowerCase().includes(q) ||
        (teacher?.name || "").toLowerCase().includes(q) ||
        (slot.room || "").toLowerCase().includes(q);
    });
  }, [slots, searchQuery, state.subjects, state.teachers]);

  const openSlot = (day: number, period: number) => {
    const existing = filteredSlots.find(s => s.dayOfWeek === day && s.period === period);
    setEditing(existing ?? {
      id: crypto.randomUUID(),
      curriculumId: activeCurriculum,
      classId, streamId: streamId || undefined,
      dayOfWeek: day, period,
    });
    setOpen(true);
  };

  const save = () => {
    if (!editing) return;
    if (!canEditTimetable) { toast.error("Only Senior Teacher or Principal can edit"); return; }
    upsertTimetableSlot(editing);
    setOpen(false);
    toast.success("Slot saved (syncing)");
  };

  const remove = () => {
    if (!editing) return;
    removeTimetableSlot(editing.id);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Timetable"
        description={canEditTimetable
          ? "You can edit this timetable. Changes sync to all devices."
          : "View-only. Only Senior Teacher or Principal can edit."}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search timetable..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-56"
              />
            </div>
            <Badge variant="outline" className={canEditTimetable ? "border-success text-success" : ""}>
              {canEditTimetable ? <><Pencil className="h-3 w-3 mr-1"/>Editor</> : <><Lock className="h-3 w-3 mr-1"/>Read only</>}
            </Badge>
          </div>
        }
      />

      <Card className="p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setStreamId(""); }}>
          <SelectTrigger><SelectValue placeholder="Class"/></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={streamId || "all"} onValueChange={(v) => setStreamId(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All streams</SelectItem>
            {streams.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center text-xs text-muted-foreground gap-2">
          <CalendarDays className="h-4 w-4"/>
          {filteredSlots.length} slot{filteredSlots.length===1?"":"s"} · {(state.timetable ?? []).filter(t => t.pending).length} pending sync
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr>
              <th className="w-16">Period</th>
              {DAYS.map(d => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(p => (
              <tr key={p}>
                <td className="font-mono text-xs text-muted-foreground">P{p}</td>
                {DAYS.map((_, di) => {
                  const day = di + 1;
                  const slot = filteredSlots.find(s => s.dayOfWeek === day && s.period === p);
                  const subject = slot ? state.subjects.find(s => s.id === slot.subjectId) : null;
                  const teacher = slot ? state.teachers.find(t => t.id === slot.teacherId) : null;
                  return (
                    <td key={day} className="align-top">
                      <button
                        onClick={() => openSlot(day, p)}
                        className={`w-full text-left rounded-md border p-2 text-xs min-h-[64px] transition-colors ${
                          slot ? "bg-primary-soft/40 border-primary/30 hover:bg-primary-soft/60"
                               : "border-dashed hover:bg-muted"
                        }`}>
                        {slot ? (
                          <>
                            <div className="font-semibold text-sm">{subject?.name ?? "—"}</div>
                            <div className="text-muted-foreground">{teacher?.name ?? "Unassigned"}</div>
                            {slot.room && <div className="text-[10px]">Room {slot.room}</div>}
                            {slot.pending && <Badge variant="outline" className="mt-1 text-[10px] border-warning text-warning-foreground">pending sync</Badge>}
                          </>
                        ) : (
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            {canEditTimetable ? <Plus className="h-3 w-3"/> : "—"}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {DAYS[(editing?.dayOfWeek ?? 1) - 1]} · Period {editing?.period}
              {!canEditTimetable && <Badge className="ml-2" variant="outline">Read-only</Badge>}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Subject</label>
                <Select value={editing.subjectId ?? ""} onValueChange={(v) => setEditing({ ...editing, subjectId: v })} disabled={!canEditTimetable}>
                  <SelectTrigger><SelectValue placeholder="Choose subject"/></SelectTrigger>
                  <SelectContent>
                    {state.subjects.filter(s => s.curriculumId === activeCurriculum).map(s =>
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teacher</label>
                <Select value={editing.teacherId ?? ""} onValueChange={(v) => setEditing({ ...editing, teacherId: v })} disabled={!canEditTimetable}>
                  <SelectTrigger><SelectValue placeholder="Assign teacher"/></SelectTrigger>
                  <SelectContent>
                    {state.teachers.filter(t => t.curriculumIds.includes(activeCurriculum)).map(t =>
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Start</label>
                  <Input type="time" value={editing.startTime ?? ""} onChange={e => setEditing({ ...editing, startTime: e.target.value })} disabled={!canEditTimetable}/>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End</label>
                  <Input type="time" value={editing.endTime ?? ""} onChange={e => setEditing({ ...editing, endTime: e.target.value })} disabled={!canEditTimetable}/>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Room</label>
                  <Input value={editing.room ?? ""} onChange={e => setEditing({ ...editing, room: e.target.value })} disabled={!canEditTimetable}/>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {canEditTimetable && editing && (state.timetable ?? []).some(t => t.id === editing.id) && (
              <Button variant="destructive" onClick={remove}><Trash2 className="h-4 w-4 mr-1"/>Remove</Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {canEditTimetable && <Button onClick={save}>Save</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
