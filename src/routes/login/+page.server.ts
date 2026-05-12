/**
 * src/routes/login/+page.server.ts
 *
 * Server load for /login.
 *
 * · If the user already has a valid session → redirect them away immediately.
 *   We look up their role in public.users to send them to the correct destination.
 * · If no session → return empty data (let the page render the form).
 */

import { redirect }           from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { getAdminClient }     from '$lib/server/auth/supabase-admin.js'

const ROLE_REDIRECTS: Record<string, string> = {
  super_admin:  '/platform',
  client_admin: '/admin',
  employee:     '/dashboard',
  cxo:          '/dashboard',
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = await locals.safeGetSession()

  if (!user) {
    // Not signed in — render the login form
    return {}
  }

  // Already signed in — look up role for correct destination
  try {
    const admin = getAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role        = profile?.role as string | undefined
    const redirectTo  = url.searchParams.get('redirect')
                     ?? (role ? ROLE_REDIRECTS[role] : null)
                     ?? '/dashboard'

    redirect(302, redirectTo)
  } catch {
    // If DB lookup fails just send to dashboard — don't block the redirect
    redirect(302, '/dashboard')
  }
}
