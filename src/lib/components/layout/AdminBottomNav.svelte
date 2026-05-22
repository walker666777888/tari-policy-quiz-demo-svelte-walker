<script lang="ts">
  import { page } from '$app/stores';

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/employees', label: 'Employees' },
    { href: '/admin/assessments', label: 'Assessments' },
    { href: '/admin/reports', label: 'Reports' }
  ];

  let activeHref = $derived.by(() => {
    const path = $page.url.pathname.replace(/\/$/, '');
    if (path.startsWith('/admin/employees')) return '/admin/employees';
    if (path.startsWith('/admin/assessments')) return '/admin/assessments';
    if (path.startsWith('/admin/reports')) return '/admin/reports';
    if (path.startsWith('/admin')) return '/admin';
    return '';
  });

  let activeIndex = $derived(links.findIndex(l => l.href === activeHref));
</script>

<nav class="md:hidden fixed bottom-3 left-4 right-4 h-[68px] bg-surface/75 backdrop-blur-2xl border border-border/70 shadow-[0_20px_40px_-8px_rgba(15,23,42,0.15),0_0_24px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.4),0_0_24px_rgba(0,0,0,0.2)] rounded-full flex z-50 p-1.5 gap-1" aria-label="Admin mobile navigation">
  <!-- Sliding Background Pill -->
  <div class="absolute inset-y-1.5 left-1.5 right-1.5 pointer-events-none transition-opacity duration-200" style="opacity: {activeIndex === -1 ? 0 : 1}">
    <div 
      class="h-full rounded-full bg-gradient-to-br from-primary to-blue-600 shadow-sm shadow-primary/20 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      style="width: calc((100% - 12px) / 4); transform: translateX(calc({activeIndex} * 100% + {activeIndex * 4}px));"
    ></div>
  </div>

  {#each links as link, i}
    {@const isActive = activeIndex === i}
    <a
      href={link.href}
      class="flex-1 flex flex-col items-center justify-center gap-1 rounded-full transition-colors duration-200 select-none overflow-hidden min-w-0 relative z-10
        {isActive ? 'text-white font-extrabold' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:text-muted-foreground'}"
      aria-current={isActive ? 'page' : undefined}
    >
      <div class="w-6 h-6 flex items-center justify-center transition-transform duration-200 {isActive ? 'scale-110' : ''}">
        {#if link.href === '/admin'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1"/>
            <rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/>
            <rect x="3" y="16" width="7" height="5" rx="1"/>
          </svg>
        {:else if link.href === '/admin/employees'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        {:else if link.href === '/admin/assessments'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        {/if}
      </div>
      <span class="text-[9px] font-bold leading-none tracking-tight truncate max-w-full">{link.label}</span>
    </a>
  {/each}
</nav>
