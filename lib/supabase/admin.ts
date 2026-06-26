import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Серверный клиент с secret-ключом — минует RLS. Использовать ТОЛЬКО на сервере
 * (webhook бота), где нет пользовательской сессии. Никогда не в браузере.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
