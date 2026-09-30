import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { School, KeyRound, Chrome } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/store/auth";
import { DEPARTMENTS } from "@/lib/schoolData";
import { supabase } from "@/lib/supabase";
import Loading from "@/components/Loading";

export default function Auth() {
  const [mode, setMode]             = useState<"signin" | "signup">("signin");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [name, setName]             = useState("");
  const [department, setDepartment] = useState<string>("");
  const [busy, setBusy]             = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const nav = useNavigate();
  const { session, loading, signIn, signUp } = useAuth();

  useEffect(() => {
    if (!loading && session) nav("/", { replace: true });
  }, [session, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, name || undefined, department || undefined);
        toast.success("Account created. You can now sign in.");
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, newPassword: forgotPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password");
      toast.success(data.message || "Password reset successfully");
      setForgotOpen(false);
      setForgotEmail("");
      setForgotPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      toast.error(message);
    } finally {
      setForgotBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 auth-bg">
      {busy ? (
        <Loading />
      ) : (
        <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <School className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Academic Compass</div>
            <div className="text-xs text-muted-foreground">Sign in to your school account</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Input
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <div>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Helps the Principal review and approve your role faster.
                </p>
              </div>
            </>
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={handleGoogleSignIn}
          >
            <Chrome className="h-4 w-4 mr-2" /> Google
          </Button>
        </form>

        <div className="mt-4 text-xs text-center text-muted-foreground">
          {mode === "signin" ? "No account?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </div>

        {mode === "signin" && (
          <p className="text-center text-gray-600 text-sm mt-3">
            <button
              type="button"
              className="text-blue-900 hover:underline inline-flex items-center gap-1"
              onClick={() => setForgotOpen(true)}
            >
              <KeyRound className="h-3.5 w-3.5" /> Forgot password?
            </button>
          </p>
        )}

        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Reset Password
              </DialogTitle>
              <DialogDescription>
                Enter your registered email address and choose a new password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  disabled={forgotBusy}
                />
              </div>
              <div>
                <Label htmlFor="forgot-password">New Password</Label>
                <Input
                  id="forgot-password"
                  type="password"
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={forgotBusy}
                />
              </div>
              <Button type="submit" className="w-full" disabled={forgotBusy}>
                {forgotBusy ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          The first account created becomes Principal (full access). Every other
          account needs Principal approval before it can access the system.
        </p>
          </Card>
        )}
      </div>
    );
  }
