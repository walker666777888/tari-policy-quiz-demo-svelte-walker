/**
 * src/routes/api/auth/logout/+server.ts
 *
 * POST /api/auth/logout
 *
 * Signs the current user out and clears the session cookies.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ALWAYS accepts POST (never GET).
 * GET-based logout is vulnerable to CSRF via <img> / <a> tags on external pages.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FLOW
 *   1. Call locals.supabase.auth.signOut()
 *      → Supabase invalidates the refresh token server-side
 *      → @supabase/ssr clears session cookies via setAll (maxAge: 0)
 *   2. Return { ok: true }  →  client redirects to /login
 *
 * UNAUTHENTICATED CALLS
 *   Safe — signOut() on an already-signed-out client is a no-op.
 *   Always returns 200 so the client can proceed to /login regardless.
 *
 * RESPONSE
 *   200  { ok: true }
 */

import { json }              from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals }) => {
  // signOut() invalidates the refresh token and calls the cookie setAll handler
  // which clears the sb-* session cookies from the browser.
  // Errors are intentionally swallowed — the goal is always to clear local state.
  try {
    await locals.supabase.auth.signOut()
  } catch (err) {
    // Log but do not fail — the client should still navigate to /login
    console.error('[logout] signOut error (non-fatal):', (err as Error).message)
  }

  return json({ ok: true }, { status: 200 })
}
