import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { state, activeCurriculum, update, resetAll } = useSchool();
  const { isPrincipal } = useAuth();
  const curriculum = state.curricula.find(c => c.id === activeCurriculum)!;

  if (!isPrincipal) {
    return (
      <div>
        <PageHeader title="Settings" description="School information, remark templates, grading scale, and app data."/>
        <Card className="p-10 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-3 text-muted-foreground"/>
          Only the Principal (overall admin) has access to school-wide settings.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="School information, remark templates, grading scale, and app data."/>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-3 md:p-4 space-y-3">
          <div className="text-sm font-medium">School</div>
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={state.settings.schoolName} onChange={(e) => update(s => { s.settings.schoolName = e.target.value; })}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Motto</label>
            <Input value={state.settings.motto} onChange={(e) => update(s => { s.settings.motto = e.target.value; })}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Address</label>
            <Input value={state.settings.address} onChange={(e) => update(s => { s.settings.address = e.target.value; })}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Academic year</label>
            <Input type="number" value={state.settings.academicYear} onChange={(e) => update(s => { s.settings.academicYear = Number(e.target.value); })}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">School logo</label>
             <input type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                update(s => { s.settings.logoUrl = reader.result as string; });
              };
              reader.readAsDataURL(file);
            }}/>
            {state.settings.logoUrl && (
              <div className="mt-2">
                <img src={state.settings.logoUrl} alt="Logo preview" className="h-12 w-12 object-contain border rounded"/>
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => update(s => { s.settings.logoUrl = ""; })}>Remove</Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-3 md:p-4 space-y-3">
          <div className="text-sm font-medium">Remark templates</div>
          <div>
            <label className="text-xs text-muted-foreground">Default class teacher remark</label>
            <Textarea value={state.settings.classTeacherRemarkTemplate} onChange={(e) => update(s => { s.settings.classTeacherRemarkTemplate = e.target.value; })}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Default principal remark</label>
            <Textarea value={state.settings.principalRemarkTemplate} onChange={(e) => update(s => { s.settings.principalRemarkTemplate = e.target.value; })}/>
          </div>
        </Card>

        <Card className="p-3 md:p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-3">Grading scale — {curriculum.name}</div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Grade</th><th>Min</th><th>Max</th><th>Points</th><th>Remark</th></tr></thead>
              <tbody>
                {curriculum.gradingScale.map((band, i) => (
                  <tr key={i}>
                    <td><input className="inline-edit w-16 font-semibold" value={band.grade}
                      onChange={(e) => update(s => { s.curricula.find(c => c.id === curriculum.id)!.gradingScale[i].grade = e.target.value; })}/></td>
                    <td><input type="number" className="inline-edit w-16" value={band.min}
                      onChange={(e) => update(s => { s.curricula.find(c => c.id === curriculum.id)!.gradingScale[i].min = Number(e.target.value); })}/></td>
                    <td><input type="number" className="inline-edit w-16" value={band.max}
                      onChange={(e) => update(s => { s.curricula.find(c => c.id === curriculum.id)!.gradingScale[i].max = Number(e.target.value); })}/></td>
                    <td><input type="number" className="inline-edit w-16" value={band.points}
                      onChange={(e) => update(s => { s.curricula.find(c => c.id === curriculum.id)!.gradingScale[i].points = Number(e.target.value); })}/></td>
                    <td><input className="inline-edit w-full" value={band.remark}
                      onChange={(e) => update(s => { s.curricula.find(c => c.id === curriculum.id)!.gradingScale[i].remark = e.target.value; })}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-3 md:p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-2">Data</div>
          <p className="text-xs text-muted-foreground mb-3">
            All data is stored locally in this browser. Reset restores the sample dataset.
          </p>
          <Button variant="destructive" onClick={() => { resetAll(); toast.success("Sample data restored"); }}>
            <RotateCcw className="h-4 w-4 mr-1"/>Reset to sample data
          </Button>
        </Card>
      </div>
    </div>
  );
}
