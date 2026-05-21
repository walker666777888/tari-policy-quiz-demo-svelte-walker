<script lang="ts">
  import { page } from '$app/stores';

  const links = [
    { href: '/dashboard', label: 'Assessments' },
    { href: '/dashboard/certificates', label: 'Certificates' },
    { href: '/dashboard/profile', label: 'Profile' },
  ];

  let activeHref = $derived.by(() => {
    const path = $page.url.pathname.replace(/\/$/, '');
    if (path.startsWith('/dashboard/certificates')) return '/dashboard/certificates';
    if (path.startsWith('/dashboard/profile')) return '/dashboard/profile';
    if (path.startsWith('/dashboard')) return '/dashboard';
    return '';
  });
</script>

<nav class="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex z-50 px-1 pb-[env(safe-area-inset-bottom)]" aria-label="Mobile navigation">
  {#each links as link}
    {@const isActive = activeHref === link.href}
    <a
      href={link.href}
      class="flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 select-none
        {isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
      aria-current={isActive ? 'page' : undefined}
    >
      <div class="w-6 h-6 flex items-center justify-center">
        {#if link.href === '/dashboard'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
          </svg>
        {:else if link.href === '/dashboard/certificates'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="6"/>
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        {/if}
      </div>
      <span class="text-[10px] font-bold leading-none">{link.label}</span>
    </a>
  {/each}
</nav>
