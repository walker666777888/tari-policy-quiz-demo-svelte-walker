/**
 * src/routes/(protected)/dashboard/(cxo)/+layout.server.ts
 *
 * Guard for CXO-exclusive quiz flows nested under /dashboard.
 * URL examples: /dashboard/cxo-quiz, /dashboard/reports, etc.
 *
 * ┌───────────────────────────────────────────────────────────────────────────
 * │  Allowed  : cxo
 * │  employee → /dashboard   (has access to dashboard but not cxo flows)
 * └───────────────────────────────────────────────────────────────────────────
 *
 * The (cxo) route group is transparent in the URL — it does not add a path
 * segment.  Pages placed here appear directly under /dashboard/.
 */

import { redirect }            from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.role !== 'cxo') {
		// Employees stay on their own dashboard; other roles were already
		// redirected by the parent dashboard layout.
		redirect(302, '/dashboard')
	}

	return {}
}
