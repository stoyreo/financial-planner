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

  const handleOAuth = async (provider: "google" | "apple") => {
    setState("loading");
    setErrorMsg("");
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setState("error");
      }
    } catch (err) {
      setErrorMsg("OAuth sign-in failed. Try email/password.");
      setState("error");
    }
  };

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

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-card px-2 text-muted-foreground">Fast track</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={state === "loading"}
            className="w-full h-11 rounded-xl border border-border bg-background hover:bg-muted
                       text-sm font-medium flex items-center justify-center gap-2 transition-all
                       disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83Z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z"/>
            </svg>
            Continue with Google
          </button>

          {process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true" && (
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={state === "loading"}
              className="w-full h-11 rounded-xl bg-black text-white text-sm font-medium
                         flex items-center justify-center gap-2 hover:bg-zinc-900 transition-all
                         disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.04-.81.86-2.13 1.53-3.22 1.45-.13-1.1.43-2.25 1.16-3.05.82-.89 2.22-1.55 3.27-1.44ZM20.5 17.41c-.55 1.27-.81 1.84-1.51 2.96-.99 1.55-2.39 3.49-4.12 3.5-1.54.02-1.94-1-4.04-.99-2.1.01-2.54 1-4.08.98-1.74-.02-3.06-1.77-4.05-3.32C0.32 16.09-.07 11.4 1.62 8.91 2.83 7.13 4.74 6.1 6.54 6.1c1.83 0 2.98 1 4.5 1 1.47 0 2.36-1 4.49-1 1.6 0 3.3.87 4.51 2.39-3.97 2.18-3.32 7.85-1.04 8.92Z"/>
              </svg>
              Continue with Apple
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
