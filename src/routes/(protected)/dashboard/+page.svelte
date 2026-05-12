<script lang="ts">
	import type { PageData } from './$types'
	let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Dashboard — Tari Policy Quiz</title></svelte:head>

<div class="page">
	<h1>Dashboard</h1>
	<p class="greeting">
		Welcome back. Your role is <strong>{data.role}</strong>.
	</p>
	<p class="placeholder">Quiz content and results will appear here.</p>
</div>

<style>
	.page        { max-width: 900px; }
	h1           { margin: 0 0 0.5rem; font-size: 1.5rem; color: #111827; }
	.greeting    { color: #374151; margin: 0 0 1rem; }
	.placeholder { color: #9ca3af; font-size: 0.9375rem; }
</style>
