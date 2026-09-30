import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { LogOut, School, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function SignOut() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const confirmSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      toast.success("Signed out successfully.");
      nav("/auth", { replace: true });
    } catch {
      toast.error("Failed to sign out. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 auth-bg">
      <Card className="w-full max-w-md p-6 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 text-destructive grid place-items-center">
          <LogOut className="h-7 w-7" />
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <School className="h-4 w-4" /> Academic Compass
        </div>

        <div>
          <h1 className="text-lg font-bold">Sign out of Academic Compass?</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You are signed in as {user?.full_name || user?.email}. You'll need to sign
            in again to enter marks, edit reports, or manage staff.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span className="font-medium">{user?.department || "—"}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => nav(-1)} disabled={busy}>
            Stay signed in
          </Button>
          <Button variant="destructive" className="flex-1" onClick={confirmSignOut} disabled={busy}>
            <LogOut className="h-4 w-4 mr-1" />
            {busy ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Marks and reports stay saved on this device.
        </div>
      </Card>
    </div>
  );
}
