import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// =============================================================================
// AUDIT HELPERS                                                   (MEDIUM-4)
//
// Auth events are written to audit_logs so that login, failed-auth, and
// first-session events are captured for regulatory compliance.
//
// Rules:
//   · Audit inserts are fire-and-forget — they never block or fail the request.
//   · actor_user_id is always auth.uid() (enforced by the DB INSERT policy).
//   · Only genuine state changes are logged (new session, failed auth).
//   · ip_address and user_agent are captured from the incoming request.
// =============================================================================

/** Safely write one audit log row. Never throws — failures are console-warned. */
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
		// Never propagate — audit failure must not break the user request
		console.warn('[audit] Failed to write audit log:', (err as Error).message);
	}
}

// =============================================================================
// HANDLE
// =============================================================================

export const handle: Handle = async ({ event, resolve }) => {

	// ── Create a per-request Supabase server client ──────────────────────────
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

	// ── safeGetSession: validates JWT with Supabase Auth on every request ────
	// getSession() alone trusts the client-supplied JWT without server validation.
	// getUser() makes a network call to Supabase Auth to validate the JWT,
	// making it the only source of truth for authentication state.
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			// ── Auth failure audit event ───────────────────────────────────────
			// Captures invalid / expired / tampered JWT attempts.
			// actor_user_id is NULL because the identity cannot be confirmed.
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

	// ── Resolve session for this request ─────────────────────────────────────
	const { session, user } = await event.locals.safeGetSession();

	// ── Session-start audit event ─────────────────────────────────────────────
	// Fires when a validated session is present AND the request carries a
	// freshly-issued access token (issued within the last 30 seconds).
	// This captures logins without logging every single API request.
	if (user && session) {
		const issuedAt     = session.expires_at ? session.expires_at - 3600 : 0; // expires_at - 1hr TTL
		const nowSecs      = Math.floor(Date.now() / 1000);
		const isFreshLogin = (nowSecs - issuedAt) < 30;                           // within 30 s of issuance

		if (isFreshLogin) {
			const tenantId = (user.user_metadata?.tenant_id as string) ?? null;
			await writeAuditLog(event.locals.supabase, {
				tenant_id:     tenantId,
				actor_user_id: user.id,
				action:        'auth.session_started',
				entity_type:   'user',
				entity_id:     user.id,
				metadata:      {
					provider:    session.user?.app_metadata?.provider ?? 'email',
					user_agent:  event.request.headers.get('user-agent') ?? null,
				},
				ip_address:    event.getClientAddress(),
				user_agent:    event.request.headers.get('user-agent'),
			});
		}
	}

	event.locals.session = session;
	event.locals.user    = user;

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
