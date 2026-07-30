import { useState } from "react";
import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, GitMerge, Server, Smartphone, Monitor, Pencil, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SyncConflict } from "@/lib/schoolData";

export default function Conflicts() {
  const { state, resolveConflict, bulkResolveConflicts } = useSchool();
  const [searchQuery, setSearchQuery] = useState("");
  const pending  = state.conflicts.filter(c => c.status === "pending");
  const resolved = state.conflicts.filter(c => c.status === "resolved");

  const matchesSearch = (c: SyncConflict) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.entity.toLowerCase().includes(q) ||
      c.field.toLowerCase().includes(q) ||
      (c.deviceName || "").toLowerCase().includes(q) ||
      (c.serverValue || "").toLowerCase().includes(q) ||
      (c.thisDeviceValue || "").toLowerCase().includes(q)
    );
  };

  const visiblePending = pending.filter(matchesSearch);
  const visibleResolved = resolved.filter(matchesSearch);

  return (
    <div>
      <PageHeader
        title="Sync Conflicts"
        description="Same field edited on multiple devices before reconnecting. Pick the correct value."
        actions={pending.length > 0 ? (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => bulkResolveConflicts("server")}>Keep all server</Button>
            <Button variant="outline" size="sm" onClick={() => bulkResolveConflicts("this")}>Use all this device</Button>
          </div>
        ) : undefined}
      />

      <Tabs defaultValue="pending">
        <div className="flex items-center justify-between mb-3">
          <TabsList>
            <TabsTrigger value="pending">Pending ({visiblePending.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({visibleResolved.length})</TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conflicts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 w-56"
            />
          </div>
        </div>

        <TabsContent value="pending" className="space-y-3 mt-3">
          {visiblePending.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-success"/>No pending conflicts
            </Card>
          )}
          {visiblePending.map(c => <ConflictCard key={c.id} c={c} onResolve={resolveConflict}/>)}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-3 mt-3">
          {visibleResolved.length === 0 && <Card className="p-8 text-center text-muted-foreground">No history yet</Card>}
          {visibleResolved.map(c => (
            <Card key={c.id} className="p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{c.field} · {c.entity}</div>
                <div className="text-xs text-muted-foreground">
                  Resolved to <b>{c.resolution}</b> · {new Date(c.timestamp).toLocaleString()}
                </div>
              </div>
              <Badge variant="secondary">
                {c.resolution === "custom" ? c.customValue : (c.resolution === "server" ? c.serverValue : c.thisDeviceValue) || ""}
              </Badge>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConflictCard({ c, onResolve }: { c: SyncConflict; onResolve: (id: string, r: SyncConflict["resolution"], custom?: string) => void }) {
  const { state } = useSchool();
  const [custom, setCustom] = useState("");
  const student = c.studentId ? state.students.find(s => s.id === c.studentId) : null;
  const subject = c.subjectId ? state.subjects.find(s => s.id === c.subjectId) : null;
  const exam    = c.examId    ? state.exams.find(e => e.id === c.examId) : null;
  const cls     = student     ? state.classes.find(cl => cl.id === student.classId) : null;
  const str     = student     ? state.streams.find(st => st.id === student.streamId) : null;

  return (
    <Card className="p-3 md:p-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <GitMerge className="h-4 w-4 text-destructive"/>
        <span className="font-medium capitalize">{c.entity} conflict · {c.field}</span>
        <Badge variant="outline" className="text-xs">{new Date(c.timestamp).toLocaleString()}</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-4">
        {student && <div><span className="block text-[10px] uppercase">Student</span><span className="text-foreground">{student.name}</span></div>}
        {student && <div><span className="block text-[10px] uppercase">Adm. No.</span><span className="text-foreground">{student.admissionNo}</span></div>}
        {cls && <div><span className="block text-[10px] uppercase">Class · Stream</span><span className="text-foreground">{cls?.name} · {str?.name}</span></div>}
        {subject && <div><span className="block text-[10px] uppercase">Subject</span><span className="text-foreground">{subject.name}</span></div>}
        {exam && <div><span className="block text-[10px] uppercase">Exam</span><span className="text-foreground">{exam.name} T{exam.term}</span></div>}
        <div><span className="block text-[10px] uppercase">Edited by</span><span className="text-foreground">{c.editedBy}</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <ChoiceBox label="Server value" icon={<Server className="h-4 w-4"/>} value={c.serverValue} meta="Cloud database"
          onClick={() => onResolve(c.id, "server")}/>
        <ChoiceBox label="This device" icon={<Monitor className="h-4 w-4"/>} value={c.thisDeviceValue} meta={c.deviceName}
          onClick={() => onResolve(c.id, "this")} highlight/>
        {c.otherDeviceValue && (
          <ChoiceBox label="Other device" icon={<Smartphone className="h-4 w-4"/>} value={c.otherDeviceValue} meta={c.otherDeviceName || ""}
            onClick={() => onResolve(c.id, "other")}/>
        )}
      </div>

      <div className="mt-3 flex gap-2 items-center">
        <Pencil className="h-4 w-4 text-muted-foreground"/>
        <Input placeholder="Custom value…" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9"/>
        <Button size="sm" variant="secondary" disabled={!custom} onClick={() => onResolve(c.id, "custom", custom)}>Use custom</Button>
      </div>
    </Card>
  );
}

function ChoiceBox({ label, value, meta, icon, onClick, highlight }: {
  label: string; value: string; meta: string; icon: React.ReactNode;
  onClick: () => void; highlight?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-lg border p-3 hover:border-primary hover:bg-primary-soft/40 transition-colors ${highlight ? "border-primary/50 bg-primary-soft/30" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold break-words">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{meta}</div>
    </button>
  );
}
