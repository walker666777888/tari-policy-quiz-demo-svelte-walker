<script lang="ts">
  import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
  import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
  import { page } from '$app/stores';
  import { fade, fly } from 'svelte/transition';
  import SkeletonLoader from '$lib/components/layout/SkeletonLoader.svelte';
  
  let { children } = $props();

  const links = [
    { href: '/super', label: 'Platform Health' },
    { href: '/super/clients', label: 'Clients' },
    { href: '/super/policies', label: 'Policies' },
    { href: '/super/users', label: 'User Management' },
    { href: '/super/audit', label: 'Audit Logs' },
    { href: '/super/settings', label: 'System Settings' },
  ];

  let currentPath = $derived($page.url.pathname);
</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden">
  <AppSidebar title="SuperAdmin" {links} />
  <div class="flex flex-col flex-1 min-w-0">
    <TopNavbar showSidebarToggle={true} />
    <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-7xl mx-auto grid grid-cols-1 grid-rows-1 w-full">
        {#key $page.url.pathname}
          <div 
            in:fly={{ x: 8, duration: 220, delay: 180 }} 
            out:fade={{ duration: 120 }} 
            class="col-start-1 row-start-1 w-full"
          >
            {@render children()}
          </div>
        {/key}
      </div>
    </main>
  </div>
</div>