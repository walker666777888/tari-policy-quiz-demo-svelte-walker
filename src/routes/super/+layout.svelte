<script lang="ts">
  import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
  import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  
  let { children } = $props();

  const links = [
    { href: '/super', label: 'Platform Health' },
    { href: '/super/clients', label: 'Clients' },
    { href: '/super/policies', label: 'Policies' },
    { href: '/super/users', label: 'User Management' },
    { href: '/super/audit', label: 'Audit Logs' },
    { href: '/super/settings', label: 'System Settings' },
  ];
</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden">
  <AppSidebar title="SuperAdmin" {links} />
  <div class="flex flex-col flex-1 min-w-0">
    <TopNavbar showSidebarToggle={true} />
    <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-7xl mx-auto w-full">
        {#key $page.url.pathname}
          <div
            in:fade={{ duration: 200, delay: 120 }}
            out:fade={{ duration: 80 }}
          >
            {@render children()}
          </div>
        {/key}
      </div>
    </main>
  </div>
</div>