import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Configure as credenciais do Supabase no servidor.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authorize(req: Request) {
  const db = admin();
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHORIZED");
  const { data } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("FORBIDDEN");
  return { db, user };
}
export function fail(e: unknown) {
  const message = e instanceof Error ? e.message : "Não foi possível concluir.";
  return NextResponse.json(
    {
      error:
        message === "UNAUTHORIZED"
          ? "Entre novamente para continuar."
          : message === "FORBIDDEN"
            ? "Acesso restrito ao administrador."
            : message,
    },
    {
      status:
        message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400,
    },
  );
}
export function appUrl() {
  const url = process.env.APP_URL || "https://thalesfranco.vercel.app";
  return url.replace(/\/$/, "");
}
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
