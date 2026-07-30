import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function Subjects() {
  const { state, activeCurriculum, update } = useSchool();
  const [searchQuery, setSearchQuery] = useState("");
  const subjects = state.subjects.filter(s => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return s.curriculumId === activeCurriculum;
    return s.curriculumId === activeCurriculum && (
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  });
  const teachers = state.teachers.filter(t => t.curriculumIds.includes(activeCurriculum));

  const add = () => update(s => {
    s.subjects.push({ id: `sub_${Date.now()}`, curriculumId: activeCurriculum, name: "New Subject", code: "NEW" });
  });

  return (
    <div>
      <PageHeader title="Subjects" description="Manage subjects offered in this curriculum."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subjects..."
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
            <Button onClick={add}><Plus className="h-4 w-4 mr-1"/>Add subject</Button>
          </div>
        } />
      <Card className="overflow-x-auto card-pad">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Subject</th><th>Teacher</th><th></th></tr></thead>
          <tbody>
            {subjects.map((sub) => (
              <tr key={sub.id}>
                <td><input className="inline-edit w-16 font-mono" value={sub.code}
                  onChange={(e) => update(s => { const x = s.subjects.find(x => x.id === sub.id); if (x) x.code = e.target.value.toUpperCase(); })}/></td>
                <td><input className="inline-edit w-56 font-medium" value={sub.name}
                  onChange={(e) => update(s => { const x = s.subjects.find(x => x.id === sub.id); if (x) x.name = e.target.value; })}/></td>
                <td>
                  <select className="inline-edit" value={sub.teacherId || ""}
                    onChange={(e) => update(s => { const x = s.subjects.find(x => x.id === sub.id); if (x) x.teacherId = e.target.value || undefined; })}>
                    <option value="">Unassigned</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td>
                  <Button variant="ghost" size="icon" onClick={() => update(s => { s.subjects = s.subjects.filter(x => x.id !== sub.id); s.deletedIds = [...(s.deletedIds ?? []), sub.id]; })}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
