<script lang="ts">
  import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
  import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
  import { theme } from '$lib/stores/theme';
  import { page } from '$app/stores';
  import { fade, fly } from 'svelte/transition';
  import SkeletonLoader from '$lib/components/layout/SkeletonLoader.svelte';
  
  let { children } = $props();

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/employees', label: 'Employees' },
    { href: '/admin/assessments', label: 'Assessments' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/settings', label: 'System Settings' }
  ];

  let currentPath = $derived($page.url.pathname);
</script>

<!-- The --color-primary custom variable dynamically paint all Tailwind primary classes -->
<div class="flex h-screen bg-background text-foreground overflow-hidden transition-all duration-300">
  <!-- Render custom dynamic fallback initial circle & title in sidebar -->
  <AppSidebar 
    title="{$theme.companyName} Admin" 
    brandColor={$theme.primaryColor}
    fallbackInitial={$theme.companyName.charAt(0)}
    {links} 
  />

  <div class="flex flex-col flex-1 min-w-0">
    <TopNavbar showSearch={true} showSidebarToggle={true} />
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