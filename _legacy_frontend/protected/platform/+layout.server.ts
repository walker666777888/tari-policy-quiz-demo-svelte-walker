/**
 * src/routes/(protected)/platform/+layout.server.ts
 *
 * Guard for /platform and all children (Tari platform staff only).
 *
 * ┌───────────────────────────────────────────────────────────────────────────
 * │  Allowed       : super_admin
 * │  client_admin  → /admin
 * │  employee/cxo  → /dashboard
 * └───────────────────────────────────────────────────────────────────────────
 */

import { redirect }            from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	const role = locals.role

	if (role !== 'super_admin') {
		if (role === 'client_admin')              redirect(302, '/admin')
		if (role === 'employee' || role === 'cxo') redirect(302, '/dashboard')
		redirect(302, '/login')
	}

	return {}
}
