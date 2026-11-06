import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=Invitation link is invalid or expired",
        requestUrl.origin,
      ),
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Authentication callback error:", error.message);

    return NextResponse.redirect(
      new URL("/login?error=Unable to verify invitation", requestUrl.origin),
    );
  }

  return NextResponse.redirect(
    new URL("/auth/set-password", requestUrl.origin),
  );
}
