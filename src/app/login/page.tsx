"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, synthesizeSession, ensureAppUserFromSupabase } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Check if already authenticated
      const session = getSession();
      if (session) {
        router.replace("/");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setErrorMsg("Please enter your email.");
      setState("error");
      return;
    }

    if (!password.trim()) {
      setErrorMsg("Please enter your password.");
      setState("error");
      return;
    }

    setState("loading");
    setErrorMsg("");

    try {
      const supabase = getSupabaseBrowser();

      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMsg(error.message || "Invalid email or password.");
        setState("error");
        return;
      }

      if (!data.user?.email) {
        setErrorMsg("Failed to retrieve user information.");
        setState("error");
        return;
      }

      // Create/retrieve AppUser and synthesize session
      const appUser = await ensureAppUserFromSupabase(data.user.email, data.user.id);
      if (!appUser) {
        setErrorMsg("User account could not be created. Please contact support.");
        setState("error");
        return;
      }

      // Synthesize the session
      synthesizeSession(appUser);

      // Redirect to home
      router.push("/");
    } catch (err) {
      setErrorMsg("An error occurred. Try again.");
      setState("error");
    }
  };

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient glow backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl animate-pulse" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="mb-3" />
          <h1 className="text-xl font-bold">Financial 101 Master crafted by Toy</h1>
          <p className="text-sm text-muted-foreground mt-1">Personal Financial Planner</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-5 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setErrorMsg("");
                  if (state === "error") setState("idle");
                }}
                required
                autoComplete="email"
                disabled={state === "loading"}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-background text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setErrorMsg("");
                  if (state === "error") setState("idle");
                }}
                required
                autoComplete="current-password"
                disabled={state === "loading"}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-background text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            {state === "error" && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg px-3 py-2">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={state === "loading" || !email.trim() || !password.trim()}
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold
                hover:bg-primary/90 active:scale-[0.98] transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-primary/20"
            >
              {state === "loading" ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
