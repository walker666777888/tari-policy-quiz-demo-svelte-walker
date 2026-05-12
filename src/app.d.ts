import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// App roles — must match public.users.role CHECK constraint
// ---------------------------------------------------------------------------
export type AppRole = 'employee' | 'cxo' | 'client_admin' | 'super_admin';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			supabase:       SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session:        Session | null;
			user:           User | null;
			/** App role read from JWT claims (custom_access_token_hook) or DB fallback. */
			role:           AppRole | null;
			/** Tenant UUID read from JWT claims or DB fallback. */
			tenantId:       string | null;
		}
		interface PageData {
			session:  Session | null;
			user:     User | null;
			role:     AppRole | null;
			tenantId: string | null;
		}
		// interface PageState {}
		interface Platform {}
	}
}

export {};
