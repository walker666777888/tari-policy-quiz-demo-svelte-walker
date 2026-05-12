<script lang="ts">
	import type { LayoutData } from './$types'

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()

	const roleLabel: Record<string, string> = {
		employee:     'Employee',
		cxo:          'CXO',
		client_admin: 'Admin',
		super_admin:  'Platform Admin',
	}

	async function signOut () {
		await fetch('/api/auth/logout', { method: 'POST' })
		window.location.href = '/login'
	}
</script>

<div class="shell">
	<header class="topbar">
		<span class="brand">Tari Policy Quiz</span>
		{#if data.role}
			<span class="role-badge">{roleLabel[data.role] ?? data.role}</span>
		{/if}
		<button type="button" class="sign-out" onclick={signOut}>Sign out</button>
	</header>
	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.shell   { min-height: 100dvh; display: flex; flex-direction: column;
	           font-family: system-ui, sans-serif; background: #f8fafc; }

	.topbar  { display: flex; align-items: center; gap: 1rem; padding: 0 1.5rem;
	           height: 56px; background: #1e3a5f; color: #fff; }

	.brand   { font-weight: 700; font-size: 1rem; margin-right: auto; }

	.role-badge { font-size: 0.75rem; background: rgba(255,255,255,0.15);
	              padding: 0.25rem 0.625rem; border-radius: 999px; }

	.sign-out { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
	            color: #fff; padding: 0.375rem 0.875rem; border-radius: 6px;
	            font-size: 0.8125rem; cursor: pointer; }
	.sign-out:hover { background: rgba(255,255,255,0.22); }

	.content { flex: 1; padding: 2rem 1.5rem; }
</style>
