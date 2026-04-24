import { NextResponse } from "next/server";

/**
 * NOTE: This callback route is deprecated. Password-based authentication
 * no longer uses OAuth callbacks. This endpoint redirects to login.
 *
 * Magic link authentication has been disabled in favor of email+password.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  console.log("[auth/callback] Deprecated endpoint accessed - redirecting to login");
  return NextResponse.redirect(`${origin}/login`);
}
