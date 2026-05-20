<script lang="ts">
	import type { LayoutData } from './$types';
	import { user } from '$lib/stores/auth';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import ThemeTransitionOverlay from '$lib/components/ui/ThemeTransitionOverlay.svelte';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	$effect(() => {
		user.set(data.user ?? null);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Premium theme transition overlay — renders globally across all portals -->
<ThemeTransitionOverlay />

{@render children()}
