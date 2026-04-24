"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import { useStore } from "@/lib/store";

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
      clearSession();
      router.replace("/login");
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
