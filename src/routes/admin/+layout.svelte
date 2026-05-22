<script lang="ts">
  import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
  import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
  import AdminBottomNav from '$lib/components/layout/AdminBottomNav.svelte';
  import { theme } from '$lib/stores/theme';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  
  let { children } = $props();

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/employees', label: 'Employees' },
    { href: '/admin/assessments', label: 'Assessments' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/settings', label: 'System Settings' }
  ];
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
    <TopNavbar showSearch={true} showSidebarToggle={false} />
    <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-7xl mx-auto pb-28 md:pb-0 w-full">
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
    <AdminBottomNav />
  </div>

</div>