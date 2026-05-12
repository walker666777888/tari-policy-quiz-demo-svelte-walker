/**
 * src/routes/(protected)/+layout.server.ts
 *
 * Base guard for all protected routes.
 * Runs before every child layout and page inside (protected)/.
 *
 * ┌───────────────────────────────────────────────────────────────────────────
 * │  Unauthenticated → /login?redirect=<current path>
 * └───────────────────────────────────────────────────────────────────────────
 *
 * No role check here — child layouts handle role specifics.
 * This layer only ensures a valid session exists.
 */

import { redirect }            from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		// Preserve the destination so the login page can redirect back after auth
		const dest = encodeURIComponent(url.pathname + url.search)
		redirect(302, `/login?redirect=${dest}`)
	}

	// Pass claims down — child layouts and pages can read data.role
	return {
		role:     locals.role,
		tenantId: locals.tenantId,
	}
}
