import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), "", {
    path: "/",
    maxAge: 0,
    httpOnly: true
  });
  return response;
}
