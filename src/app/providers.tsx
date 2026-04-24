"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";

// Paths that render standalone (no AppShell wrapper). Must stay in sync with
// AuthGuard's PUBLIC_PATHS so the login page etc. render without any
// authenticated UI (sidebar, profile card, version popups, etc).
const PUBLIC_PATHS = ["/login", "/login/"];

// ssr:false — prevents ANY server-side execution of browser-API-dependent code
// This is the correct pattern for fully client-side apps with static export
const AuthGuard = dynamic(
  () => import("@/components/AuthGuard").then(m => ({ default: m.AuthGuard })),
  { ssr: false, loading: () => (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  )}
);

const AppShell = dynamic(
  () => import("@/components/layout/AppShell").then(m => ({ default: m.AppShell })),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthGuard>
        {isPublic ? children : <AppShell>{children}</AppShell>}
      </AuthGuard>
    </ThemeProvider>
  );
}
