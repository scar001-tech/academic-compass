import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export default function Classes() {
  const { state, activeCurriculum, update } = useSchool();
  const [searchQuery, setSearchQuery] = useState("");
  const classes = state.classes.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return c.curriculumId === activeCurriculum;
    return c.curriculumId === activeCurriculum && c.name.toLowerCase().includes(q);
  });
  const teachers = state.teachers.filter(t => t.curriculumIds.includes(activeCurriculum));

  const addClass = () => update((s) => {
    s.classes.push({ id: `cls_${Date.now()}`, curriculumId: activeCurriculum, name: "New Class" });
  });
  const addStream = (classId: string) => update((s) => {
    s.streams.push({ id: `str_${Date.now()}`, classId, name: "New Stream" });
  });

  return (
    <div>
      <PageHeader
        title="Classes & Streams"
        description="Organize learners into classes and streams for this curriculum."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-56"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={addClass}><Plus className="h-4 w-4 mr-1"/>Add class</Button>
          </div>
        }
      />

      <div className="grid gap-3">
        {classes.map((c) => {
          const streams = state.streams.filter(s => s.classId === c.id);
          const count = state.students.filter(s => s.classId === c.id).length;
          return (
            <Card key={c.id} className="p-3 md:p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <input className="inline-edit text-lg font-semibold" value={c.name}
                  onChange={(e) => update(s => { const x = s.classes.find(x => x.id === c.id); if (x) x.name = e.target.value; })}/>
                <span className="text-xs text-muted-foreground">{count} students · {streams.length} streams</span>
                <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Class teacher</label>
                  <select className="inline-edit text-sm" value={c.classTeacherId || ""}
                    onChange={(e) => update(s => { const x = s.classes.find(x => x.id === c.id); if (x) x.classTeacherId = e.target.value || undefined; })}>
                    <option value="">Unassigned</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (count > 0) { toast.error("Class has students — reassign them first"); return; }
                     update(s => { s.classes = s.classes.filter(x => x.id !== c.id); s.streams = s.streams.filter(x => x.classId !== c.id); s.deletedIds = [...(s.deletedIds ?? []), c.id, ...s.streams.filter(x => x.classId === c.id).map(x => x.id)]; });
                  }}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {streams.map((str) => (
                  <div key={str.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm bg-muted/40">
                    <input className="inline-edit w-24" value={str.name}
                      onChange={(e) => update(s => { const x = s.streams.find(x => x.id === str.id); if (x) x.name = e.target.value; })}/>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update(s => { s.streams = s.streams.filter(x => x.id !== str.id); s.deletedIds = [...(s.deletedIds ?? []), str.id]; })}>
                      <Trash2 className="h-3 w-3 text-destructive"/>
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addStream(c.id)}><Plus className="h-3 w-3 mr-1"/>Stream</Button>
              </div>
            </Card>
          );
        })}
        {classes.length === 0 && <Card className="p-6 md:p-8 text-center text-muted-foreground">No classes yet</Card>}
      </div>
    </div>
  );
}
