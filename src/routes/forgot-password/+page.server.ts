/**
 * src/routes/forgot-password/+page.server.ts
 *
 * Redirect logged-in users away from the forgot-password page.
 * An active session means the user can change their password via account settings.
 */

import { redirect }           from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const { user } = await locals.safeGetSession()
  if (user) {
    redirect(302, '/dashboard')
  }
  return {}
}
