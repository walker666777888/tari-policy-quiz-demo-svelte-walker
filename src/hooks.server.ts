import { createServerClient }    from '@supabase/ssr';
import { type Handle, json }     from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { getAdminClient }        from '$lib/server/auth/supabase-admin.js';
import type { AppRole }          from './app.js';

// =============================================================================
// JWT HELPERS
// =============================================================================

/**
 * Decode the payload of a JWT without verifying the signature.
 * Signature verification has already been done by Supabase's getUser().
 */
function decodeJwtPayload (token: string): Record<string, unknown> {
	try {
		const base64Url = token.split('.')[1]
		if (!base64Url) return {}
		// Base64url → base64 → JSON
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
		return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
	} catch {
		return {}
	}
}

// =============================================================================
// ROLE HELPERS
// =============================================================================

const VALID_ROLES = new Set<AppRole>(['employee', 'cxo', 'client_admin', 'super_admin'])

function isValidRole (r: unknown): r is AppRole {
	return typeof r === 'string' && VALID_ROLES.has(r as AppRole)
}

/**
 * Resolve role + tenant_id for an authenticated user.
 *
 * Priority:
 *  1. JWT claims  (fast, no DB round-trip; requires custom_access_token_hook)
 *  2. DB lookup   (fallback when hook is not yet registered)
 */
async function resolveRoleClaims (
	userId:      string,
	accessToken: string
): Promise<{ role: AppRole | null; tenantId: string | null }> {
	// ── 1. Try JWT claims first ────────────────────────────────────────────────
	const payload   = decodeJwtPayload(accessToken)
	const jwtRole   = payload['role']
	const jwtTenant = payload['tenant_id']

	if (isValidRole(jwtRole) && typeof jwtTenant === 'string' && jwtTenant) {
		return { role: jwtRole, tenantId: jwtTenant }
	}

	// ── 2. Fallback: DB lookup (hook not yet registered) ──────────────────────
	try {
		const admin = getAdminClient()
		const { data } = await admin
			.from('users')
			.select('role, tenant_id')
			.eq('id', userId)
			.single()

		const dbRole   = isValidRole(data?.role) ? (data!.role as AppRole) : null
		const dbTenant = typeof data?.tenant_id === 'string' ? data.tenant_id : null
		return { role: dbRole, tenantId: dbTenant }
	} catch {
		return { role: null, tenantId: null }
	}
}

// =============================================================================
// AUDIT HELPERS
// =============================================================================

async function writeAuditLog(
	supabase: ReturnType<typeof createServerClient>,
	payload: {
		tenant_id:     string | null;
		actor_user_id: string | null;
		action:        string;
		entity_type:   string;
		entity_id?:    string | null;
		metadata?:     Record<string, unknown>;
		ip_address?:   string | null;
		user_agent?:   string | null;
	}
): Promise<void> {
	try {
		await supabase.from('audit_logs').insert({
			tenant_id:     payload.tenant_id,
			actor_user_id: payload.actor_user_id,
			action:        payload.action,
			entity_type:   payload.entity_type,
			entity_id:     payload.entity_id    ?? null,
			metadata:      payload.metadata     ?? {},
			ip_address:    payload.ip_address   ?? null,
			user_agent:    payload.user_agent   ?? null,
		});
	} catch (err) {
		console.warn('[audit] Failed to write audit log:', (err as Error).message);
	}
}

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

/**
 * Roles permitted to access each protected route prefix.
 * Layout server files enforce these too; this is the fast-path for API routes.
 */
const PAGE_ROUTE_ROLES: Array<{ prefix: string; allowed: AppRole[] }> = [
	{ prefix: '/platform', allowed: ['super_admin']                   },
	{ prefix: '/admin',    allowed: ['client_admin']                  },
	{ prefix: '/dashboard',allowed: ['employee', 'cxo', 'client_admin', 'super_admin'] },
]

/**
 * API routes that require authentication and a specific role.
 * Returning early from handle() means the route handler never fires.
 */
const API_ROUTE_ROLES: Array<{ prefix: string; allowed: AppRole[] }> = [
	{ prefix: '/api/admin/',    allowed: ['client_admin']  },
	{ prefix: '/api/platform/', allowed: ['super_admin']   },
]

/** Routes that are always public (no auth check). */
function isPublicPath (path: string): boolean {
	return (
		path === '/'                        ||
		path.startsWith('/login')           ||
		path.startsWith('/forgot-password') ||
		path.startsWith('/auth/')           ||
		path.startsWith('/api/auth/')
	)
}

// =============================================================================
// HANDLE
// =============================================================================

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname

	// ── Create per-request Supabase server client ───────────────────────────
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// ── safeGetSession ──────────────────────────────────────────────────────
	event.locals.safeGetSession = async () => {
		const { data: { session } } = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const { data: { user }, error } = await event.locals.supabase.auth.getUser();

		if (error) {
			const tenantId = (session.user?.user_metadata?.tenant_id as string) ?? null;
			await writeAuditLog(event.locals.supabase, {
				tenant_id:     tenantId,
				actor_user_id: null,
				action:        'auth.validation_failed',
				entity_type:   'session',
				metadata:      { error_code: error.code ?? 'unknown', error_message: error.message },
				ip_address:    event.getClientAddress(),
				user_agent:    event.request.headers.get('user-agent'),
			});
			return { session: null, user: null };
		}

		return { session, user };
	};

	// ── Resolve session ─────────────────────────────────────────────────────
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user    = user;

	// ── Resolve role + tenantId ─────────────────────────────────────────────
	// Extracted from JWT claims (fast path) or DB fallback (when hook not live).
	let role:     AppRole | null = null
	let tenantId: string | null  = null

	if (user && session?.access_token) {
		const resolved = await resolveRoleClaims(user.id, session.access_token)
		role     = resolved.role
		tenantId = resolved.tenantId
	}

	event.locals.role     = role
	event.locals.tenantId = tenantId

	// ── Session-start audit ─────────────────────────────────────────────────
	if (user && session) {
		const issuedAt     = session.expires_at ? session.expires_at - 3600 : 0;
		const nowSecs      = Math.floor(Date.now() / 1000);
		const isFreshLogin = (nowSecs - issuedAt) < 30;

		if (isFreshLogin) {
			await writeAuditLog(event.locals.supabase, {
				tenant_id:     tenantId,
				actor_user_id: user.id,
				action:        'auth.session_started',
				entity_type:   'user',
				entity_id:     user.id,
				metadata: {
					provider:  session.user?.app_metadata?.provider ?? 'email',
					role,
				},
				ip_address: event.getClientAddress(),
				user_agent: event.request.headers.get('user-agent'),
			});
		}
	}

	// ── Skip guards for public paths ────────────────────────────────────────
	if (isPublicPath(path)) {
		return resolve(event, {
			filterSerializedResponseHeaders (name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		})
	}

	// ── API route guards ────────────────────────────────────────────────────
	// Fast-fail before the route handler fires. Returns JSON (not a redirect).
	for (const { prefix, allowed } of API_ROUTE_ROLES) {
		if (!path.startsWith(prefix)) continue

		if (!user) {
			return json(
				{ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
				{ status: 401 }
			)
		}
		if (!role || !allowed.includes(role)) {
			await writeAuditLog(event.locals.supabase, {
				tenant_id:     tenantId,
				actor_user_id: user.id,
				action:        'auth.api_access_denied',
				entity_type:   'api_route',
				metadata:      { path, required_roles: allowed, user_role: role },
				ip_address:    event.getClientAddress(),
				user_agent:    event.request.headers.get('user-agent'),
			})
			return json(
				{ ok: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' } },
				{ status: 403 }
			)
		}
		break   // matched prefix — access granted, proceed to handler
	}

	// ── Page route access logging ───────────────────────────────────────────
	// Layout server files do the actual redirect. We only log denied attempts here
	// for routes where the user is authenticated but has the wrong role.
	if (user && role) {
		for (const { prefix, allowed } of PAGE_ROUTE_ROLES) {
			if (!path.startsWith(prefix)) continue
			if (!allowed.includes(role)) {
				await writeAuditLog(event.locals.supabase, {
					tenant_id:     tenantId,
					actor_user_id: user.id,
					action:        'auth.page_access_denied',
					entity_type:   'page_route',
					metadata:      { path, required_roles: allowed, user_role: role },
					ip_address:    event.getClientAddress(),
					user_agent:    event.request.headers.get('user-agent'),
				})
			}
			break
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders (name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	})
}
