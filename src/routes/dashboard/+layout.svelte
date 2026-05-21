<script lang="ts">
  import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { fade, fly } from 'svelte/transition';
  import SkeletonLoader from '$lib/components/layout/SkeletonLoader.svelte';

  let { children } = $props();

  const links = [
    { href: '/dashboard', label: 'My Assessments' },
    { href: '/dashboard/certificates', label: 'Certificates' },
    { href: '/dashboard/profile', label: 'My Profile' },
  ];

  // Robust active tab matching that handles sub-routes and prevents overlapping
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
  /* ═══════════════════════════════════════════════════════
     FLOATING FROSTED-GLASS NAV — ground-up rewrite
     Rules:
       1. Nav container owns all spacing (padding + gap)
       2. Items: NO margin, NO transform, NO position:relative
       3. Transition: ONLY color + background-color
     ═══════════════════════════════════════════════════════ */
  .float-nav {
    position: fixed;
    bottom: 20px;
    left: 16px;
    width: calc(100vw - 32px);
    height: 64px;
    border-radius: 20px;
    z-index: 100;
    /* Container owns all spacing — children never need margin */
    display: flex;
    align-items: stretch;
    padding: 6px;
    gap: 4px;
    /* Frosted glass: iOS 15+ Tab Bar exact values */
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(20px) saturate(1.8) !important;
    -webkit-backdrop-filter: blur(20px) saturate(1.8) !important;
    border: 1px solid rgba(255, 255, 255, 0.60);
    box-shadow:
      0 2px 8px  rgba(15, 23, 42, 0.08),
      0 8px 28px rgba(15, 23, 42, 0.10),
      inset 0 1px 0 rgba(255, 255, 255, 0.85);
    will-change: transform;
    transform: translateZ(0);
  }

  :global(.dark) .float-nav {
    background: rgba(28, 28, 30, 0.70);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 2px 8px  rgba(0, 0, 0, 0.25),
      0 8px 28px rgba(0, 0, 0, 0.30),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  /* Items — NO margin, NO transform, NO position, NO box-shadow in transition */
  .float-nav-item {
    width: calc((100% - 8px) / 3);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 14px;
    text-decoration: none;
    color: rgba(100, 116, 139, 0.85);
    /* No color transition to prevent sub-pixel antialiasing shifts */
    transition: background-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    user-select: none;
  }

  /* Active: full-item solid white pill */
  .float-nav-item.float-active {
    color: #0f172a;
    background-color: rgba(255, 255, 255, 0.95);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.10), 0 3px 10px rgba(15, 23, 42, 0.08);
  }

  :global(.dark) .float-nav-item.float-active {
    color: #f1f5f9;
    background-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.20), 0 3px 10px rgba(0, 0, 0, 0.15);
  }

  .float-nav-bubble {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .float-nav-label {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.57rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
  }

  /* Hard-hide on tablet/desktop */
  @media (min-width: 768px) {
    .float-nav { display: none !important; }
  }
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

      <nav class="hidden md:flex gap-6">
        {#each links as link}
          <a
            href={link.href}
            class="text-xs font-semibold transition-all duration-200 hover:scale-105
              { activeHref === link.href
                ? 'text-primary font-bold border-b-2 border-primary pb-1'
                : 'text-muted-foreground hover:text-foreground' }"
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

    <!-- Floating Frosted Glass Mobile Bottom Nav -->
    <nav class="float-nav" aria-label="Mobile navigation">
      {#each links as link}
        {@const isActive = activeHref === link.href}
        <a
          href={link.href}
          class="float-nav-item"
          class:float-active={isActive}
          aria-current={isActive ? 'page' : undefined}
        >
          <!-- Icon bubble -->
          <div class="float-nav-bubble">
            {#if link.href === '/dashboard'}
              <!-- Assessments: clipboard-list -->
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
              </svg>
            {:else if link.href === '/dashboard/certificates'}
              <!-- Certificates: award ribbon -->
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="6"/>
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
            {:else}
              <!-- Profile: user -->
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            {/if}
          </div>

          <!-- Label -->
          <span class="float-nav-label">{link.label}</span>



        </a>
      {/each}
    </nav>
  </div>

</div>