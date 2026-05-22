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

  let activeIndex = $derived(links.findIndex(l => l.href === activeHref));
</script>

<nav class="md:hidden fixed bottom-3 left-4 right-4 h-[68px] bg-surface/75 backdrop-blur-2xl border border-border/70 shadow-[0_20px_40px_-8px_rgba(15,23,42,0.15),0_0_24px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.4),0_0_24px_rgba(0,0,0,0.2)] rounded-full flex z-50 p-1.5 gap-1" aria-label="Mobile navigation">
  <!-- Sliding Background Pill -->
  <div class="absolute inset-y-1.5 left-1.5 right-1.5 pointer-events-none transition-opacity duration-200" style="opacity: {activeIndex === -1 ? 0 : 1}">
    <div 
      class="h-full rounded-full bg-gradient-to-br from-primary to-blue-600 shadow-sm shadow-primary/20 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      style="width: calc((100% - 8px) / 3); transform: translateX(calc({activeIndex} * 100% + {activeIndex * 4}px));"
    ></div>
  </div>

  {#each links as link, i}
    {@const isActive = activeIndex === i}
    <a
      href={link.href}
      class="flex-1 flex flex-col items-center justify-center gap-1 rounded-full transition-colors duration-200 select-none overflow-hidden min-w-0 relative z-10
        {isActive ? 'text-white' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:text-muted-foreground '}"
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
