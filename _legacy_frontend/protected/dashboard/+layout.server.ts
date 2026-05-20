/**
 * src/routes/(protected)/dashboard/+layout.server.ts
 *
 * Guard for /dashboard and all children.
 *
 * ┌───────────────────────────────────────────────────────────────────────────
 * │  Allowed     : employee, cxo
 * │  client_admin → /admin
 * │  super_admin  → /platform
 * └───────────────────────────────────────────────────────────────────────────
 *
 * Note: the (protected) parent layout has already verified session exists.
 * This layer only checks role.
 */

import { redirect }            from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

const ALLOWED_ROLES = new Set(['employee', 'cxo'])

export const load: LayoutServerLoad = async ({ locals }) => {
	const role = locals.role

	if (!ALLOWED_ROLES.has(role ?? '')) {
		// Send each wrong-role user to their own home
		if (role === 'client_admin') redirect(302, '/admin')
		if (role === 'super_admin')  redirect(302, '/platform')
		// No role at all (shouldn't reach here — parent guards session)
		redirect(302, '/login')
	}

	return {}
}
