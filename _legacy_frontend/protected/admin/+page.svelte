<script lang="ts">
	import type { PageData } from './$types'
	let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Admin — Tari Policy Quiz</title></svelte:head>

<div class="page">
	<h1>Admin Panel</h1>
	<p class="note">Signed in as <strong>{data.role}</strong> for tenant <code>{data.tenantId}</code>.</p>
	<nav class="quick-links">
		<a href="/admin/users">Users</a>
	</nav>
</div>

<style>
	.page        { max-width: 1100px; }
	h1           { margin: 0 0 0.5rem; font-size: 1.5rem; color: #111827; }
	.note        { color: #374151; margin: 0 0 1.5rem; font-size: 0.9375rem; }
	code         { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 4px;
	               font-size: 0.875rem; }
	.quick-links { display: flex; gap: 1rem; }
	.quick-links a { color: #2563eb; text-decoration: none; font-weight: 500; }
	.quick-links a:hover { text-decoration: underline; }
</style>
