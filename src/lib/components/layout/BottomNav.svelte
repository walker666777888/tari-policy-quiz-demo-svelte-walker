<script lang="ts">
  import { page } from '$app/stores';

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
</script>

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

<style>
  /* ═══════════════════════════════════════════════════════
     FLOATING FROSTED-GLASS NAV (GRID ARCHITECTURE)
     Rules:
       1. Grid columns 1fr 1fr 1fr guarantee identical widths
       2. Items strictly span 1 column, zero layout calculations based on content
       3. ONLY color transitions
     ═══════════════════════════════════════════════════════ */
  .float-nav {
    position: fixed;
    bottom: 20px;
    left: 16px;
    right: 16px;
    width: auto;
    height: 64px;
    border-radius: 20px;
    z-index: 100;
    overflow: hidden;
    /* Container owns all spacing — Grid guarantees identical columns */
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
  }

  :global(.dark) .float-nav {
    background: rgba(28, 28, 30, 0.70);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 2px 8px  rgba(0, 0, 0, 0.25),
      0 8px 28px rgba(0, 0, 0, 0.30),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  /* Items — NO margin, NO transform, NO position, strictly Grid bounded */
  .float-nav-item {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 14px;
    text-decoration: none;
    color: rgba(100, 116, 139, 0.85);
    /* Smooth color fade for Apple iOS style */
    transition: color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    outline-offset: -2px;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .float-nav-item:focus,
  .float-nav-item:focus-visible,
  .float-nav-item:active {
    outline: none;
    outline-offset: -2px;
    box-shadow: none;
  }

  .float-nav-item:hover {
    /* prevent any browser-default hover shifts */
    transform: none;
  }

  /* Active: Only color change, NO background pill (True Apple iOS Style) */
  .float-nav-item.float-active {
    color: #0f172a;
    /* Native Apple tab bars do not have active background pills */
  }

  :global(.dark) .float-nav-item.float-active {
    color: #ffffff;
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
