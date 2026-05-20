<script lang="ts">
	import type { PageData } from './$types'
	let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>CXO Quiz — Tari Policy Quiz</title></svelte:head>

<div class="page">
	<h1>CXO Quiz Flow</h1>
	<p class="note">This section is available to <strong>CXO</strong> users only.</p>
	<p class="placeholder">CXO-specific quiz content will appear here.</p>
</div>

<style>
	.page        { max-width: 900px; }
	h1           { margin: 0 0 0.5rem; font-size: 1.5rem; color: #111827; }
	.note        { color: #374151; margin: 0 0 1rem; }
	.placeholder { color: #9ca3af; font-size: 0.9375rem; }
</style>
