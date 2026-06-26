import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Серверный клиент Supabase (Server Components, Server Actions, Route Handlers).
 * Использует cookie-сессию пользователя — все запросы проходят через RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Вызвано из Server Component — запись кук невозможна.
            // Сессию обновляет middleware, поэтому это безопасно игнорировать.
          }
        },
      },
    },
  );
}
