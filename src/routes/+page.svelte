<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Tari Policy Quiz</title>
</svelte:head>

<main>
	<h1>Welcome to Tari Policy Quiz</h1>
	{#if data.user}
		<p>Signed in as {data.user.email}</p>
	{:else}
		<p>Please sign in to continue.</p>
	{/if}
</main>
