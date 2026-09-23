import { createClient } from "@supabase/supabase-js";
import { authenticatedRequest } from "./auth-request";
export const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = configured
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  : null;
export async function api(path: string, body?: unknown) {
  return authenticatedRequest(path, body, async (refresh) => {
    if (!supabase) return null;
    const result = refresh
      ? await supabase.auth.refreshSession()
      : await supabase.auth.getSession();
    if (result.error) {
      if (result.error.status && result.error.status >= 500)
        throw new Error(
          "Não foi possível conectar ao serviço de login. Tente novamente em instantes.",
        );
      return null;
    }
    return result.data.session?.access_token || null;
  });
}
