<script lang="ts">
  import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { fade, fly } from 'svelte/transition';
  import SkeletonLoader from '$lib/components/layout/SkeletonLoader.svelte';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';

  let { children } = $props();

  const links = [
    { href: '/dashboard', label: 'My Assessments' },
    { href: '/dashboard/certificates', label: 'Certificates' },
    { href: '/dashboard/profile', label: 'My Profile' },
  ];

  let activeHref = $derived.by(() => {
    const path = $page.url.pathname.replace(/\/$/, '');
    if (path.startsWith('/dashboard/certificates')) return '/dashboard/certificates';
    if (path.startsWith('/dashboard/profile')) return '/dashboard/profile';
    if (path.startsWith('/dashboard')) return '/dashboard';
    return '';
  });

  // Floating icons config: emoji + position + animation delay + size + opacity
  const floatingIcons = [
    { icon: '📚', top: '12%',  left: '4%',   delay: '0s',    size: '1.6rem', dur: '7s'  },
    { icon: '🖊️', top: '25%',  left: '91%',  delay: '1.2s',  size: '1.3rem', dur: '9s'  },
    { icon: '💻', top: '55%',  left: '3%',   delay: '2.5s',  size: '1.7rem', dur: '8s'  },
    { icon: '📋', top: '75%',  left: '90%',  delay: '0.8s',  size: '1.5rem', dur: '11s' },
    { icon: '🏆', top: '8%',   left: '78%',  delay: '3.2s',  size: '1.4rem', dur: '10s' },
    { icon: '📝', top: '42%',  left: '94%',  delay: '1.8s',  size: '1.3rem', dur: '7.5s'},
    { icon: '🔒', top: '88%',  left: '8%',   delay: '0.5s',  size: '1.4rem', dur: '9.5s'},
    { icon: '📊', top: '18%',  left: '14%',  delay: '4s',    size: '1.2rem', dur: '8.5s'},
    { icon: '✍️', top: '68%',  left: '82%',  delay: '2s',    size: '1.3rem', dur: '12s' },
    { icon: '📜', top: '35%',  left: '6%',   delay: '3.5s',  size: '1.4rem', dur: '9s'  },
    { icon: '🖥️', top: '82%',  left: '55%',  delay: '1s',    size: '1.5rem', dur: '8s'  },
    { icon: '⚖️', top: '14%',  left: '50%',  delay: '5s',    size: '1.2rem', dur: '11s' },
    { icon: '📁', top: '60%',  left: '18%',  delay: '2.8s',  size: '1.3rem', dur: '10s' },
    { icon: '🎓', top: '90%',  left: '35%',  delay: '1.5s',  size: '1.6rem', dur: '7.5s'},
    { icon: '🔍', top: '48%',  left: '88%',  delay: '3.8s',  size: '1.2rem', dur: '9s'  },
  ];

  let currentPath = $derived($page.url.pathname);
</script>

<style>
  /* Ambient blob styles if needed */
</style>

<!-- The --color-primary custom variable dynamically paint all Tailwind primary classes -->
<div class="h-screen bg-background text-foreground relative overflow-hidden">

  <!-- Floating compliance-themed background icons -->
  {#each floatingIcons as item}
    <span
      class="floating-bg-icon"
      style="top:{item.top}; left:{item.left}; font-size:{item.size}; animation-duration:{item.dur}; animation-delay:{item.delay};"
      aria-hidden="true"
    >
      {item.icon}
    </span>
  {/each}

  <!-- Soft ambient radial gradient blobs -->
  <div class="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
    <div class="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[80px]"></div>
    <div class="absolute bottom-[-10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-indigo-500/4 blur-[80px]"></div>
  </div>

  <div class="relative z-10 flex flex-col h-full">
    <TopNavbar>
      <!-- Brand Logo / Avatar and Dynamic Client Name -->
      <div class="flex items-center gap-2.5">
        {#if $theme.logoUrl}
          <div class="h-8 rounded overflow-hidden flex items-center justify-center">
            <img src={$theme.logoUrl} alt="Company Logo" class="h-full object-contain" />
          </div>
        {:else}
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-extrabold shadow-sm border border-black/5 shrink-0 transition-all duration-300 transform hover:scale-105 bg-primary">
            {$theme.companyName.charAt(0)}
          </div>
        {/if}
        <span class="font-bold text-[13px] text-foreground tracking-tight truncate max-w-[180px]">{$theme.companyName}</span>
      </div>

      <nav class="hidden md:flex items-center gap-1 p-1.5 bg-surface border border-border rounded-2xl shadow-sm">
        {#each links as link}
          <a
            href={link.href}
            class="relative px-4 py-2 text-[13px] font-bold rounded-xl transition-colors duration-300 ease-out select-none
              { activeHref === link.href
                ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-md shadow-primary/25'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground' }"
          >
            {link.label}
          </a>
        {/each}
      </nav>
    </TopNavbar>

    <main class="flex-1 py-6 px-4 md:py-10 md:px-6 lg:px-12 overflow-y-auto">
      <div class="max-w-5xl mx-auto pb-28 md:pb-0 w-full">
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

    <BottomNav />
  </div>

</div>