/**
 * src/lib/server/auth/supabase-admin.ts
 *
 * Service-role Supabase client for server-side operations.
 *
 * RULES:
 *  · This file lives under src/lib/SERVER — SvelteKit prevents it from
 *    being imported by any client-side module at build time.
 *  · The service-role key bypasses RLS entirely. Only use this client for
 *    privileged operations (invite creation, OTP verification, bulk import).
 *  · The Authorization header is pinned explicitly to avoid the GoTrueClient
 *    async-init race that can silently downgrade to the anon role.
 *  · The singleton is module-scoped; on Vercel it persists across warm
 *    invocations which is intentional (avoids re-creating TLS connections).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL }     from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null

/**
 * Returns the module-level service-role Supabase client.
 * Lazily created on first call; reused on subsequent calls within the same
 * process / warm Vercel invocation.
 */
export function getAdminClient (): SupabaseClient {
  if (_client) return _client

  _client = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Pinned explicitly — prevents GoTrueClient async-init race where
        // the first request fires before the auth state settles and sends
        // no Bearer token (resulting in "permission denied for table X").
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  })

  return _client
}

// ---------------------------------------------------------------------------
// Typed helper — narrow return to avoid `any` in callers
// ---------------------------------------------------------------------------

export type AdminClient = ReturnType<typeof getAdminClient>
