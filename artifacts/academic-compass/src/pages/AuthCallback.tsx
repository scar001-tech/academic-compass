import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/store/auth";
import { Card } from "@/components/ui/card";
import Loading from "@/components/Loading";

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const { signIn } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error: supabaseError } = await supabase.auth.getSession();
        if (supabaseError || !data.session) {
          throw new Error(supabaseError?.message || "No session found");
        }

        const accessToken = data.session.access_token;
        const refreshToken = data.session.refresh_token;
        const user = data.session.user;

        const res = await fetch("/api/auth/supabase-callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            supabase_uid: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            department: user.user_metadata?.department || null,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Failed to link Supabase account");

        await signIn(result.email, result.temp_password || "");
        nav("/", { replace: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        setError(message);
        setTimeout(() => nav("/auth", { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [nav, signIn]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <h1 className="text-lg font-bold">Authentication Error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Redirecting to login...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="w-full max-w-md p-6 text-center space-y-4">
        <Loading />
        <p className="text-sm text-muted-foreground">Completing Google sign-in...</p>
      </Card>
    </div>
  );
}
