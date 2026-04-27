"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession, clearSession, ensureAppUserFromSupabase, synthesizeSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const PUBLIC_PATHS = ["/login", "/login/"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const { loadUserNamespace } = useStore();

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));
    if (isPublic) { setAuthed(true); return; }

    const session = getSession();
    if (!session) {
      // Check for Supabase session (OAuth callback)
      (async () => {
        try {
          const supabase = getSupabaseBrowser();
          const { data: { session: sbSession } } = await supabase.auth.getSession();
          if (sbSession?.user?.email) {
            const appUser = await ensureAppUserFromSupabase(sbSession.user.email, sbSession.user.id);
            if (appUser) {
              synthesizeSession(appUser);
              loadUserNamespace();
              setAuthed(true);
              return;
            }
          }
        } catch { /* non-fatal */ }

        clearSession();
        router.replace("/login");
      })();
      return;
    }
    loadUserNamespace();
    setAuthed(true);
  }, [pathname]);

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return <>{children}</>;
}
