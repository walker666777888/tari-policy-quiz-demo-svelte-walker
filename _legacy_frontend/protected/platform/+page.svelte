<script lang="ts">
	import type { PageData } from './$types'
	let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Platform Admin — Tari Policy Quiz</title></svelte:head>

<div class="page">
	<h1>Platform Administration</h1>
	<p class="note">
		Tari staff access only. Signed in as <strong>{data.role}</strong>.
	</p>
	<p class="placeholder">Tenant management, billing, and global config will appear here.</p>
</div>

<style>
	.page        { max-width: 1100px; }
	h1           { margin: 0 0 0.5rem; font-size: 1.5rem; color: #111827; }
	.note        { color: #374151; margin: 0 0 1rem; font-size: 0.9375rem; }
	.placeholder { color: #9ca3af; font-size: 0.9375rem; }
</style>
