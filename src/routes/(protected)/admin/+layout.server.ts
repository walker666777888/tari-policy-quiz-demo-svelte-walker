/**
 * src/routes/(protected)/admin/+layout.server.ts
 *
 * Guard for /admin and all children (user management, settings, reports, etc.)
 *
 * ┌───────────────────────────────────────────────────────────────────────────
 * │  Allowed     : client_admin
 * │  employee/cxo → /dashboard
 * │  super_admin  → /platform
 * └───────────────────────────────────────────────────────────────────────────
 */

import { redirect }            from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	const role = locals.role

	if (role !== 'client_admin') {
		if (role === 'super_admin')               redirect(302, '/platform')
		if (role === 'employee' || role === 'cxo') redirect(302, '/dashboard')
		redirect(302, '/login')
	}

	return {}
}
