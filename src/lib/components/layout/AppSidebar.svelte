<script lang="ts">
  import { page } from '$app/stores';
  import { isSidebarOpen } from '$lib/stores/sidebar';

  type SidebarLink = {
    href: string;
    label: string;
    icon?: string;
  };

  let { 
    links = [], 
    title = "CompliancePro",
    brandColor = "#0d9488",
    logoUrl = null,
    fallbackInitial = null
  } = $props<{ 
    links?: SidebarLink[], 
    title?: string,
    brandColor?: string,
    logoUrl?: string | null,
    fallbackInitial?: string | null
  }>();

  let mainLinks = $derived(links.filter((link: SidebarLink) => !link.label.toLowerCase().includes('setting')));
  let settingsLinks = $derived(links.filter((link: SidebarLink) => link.label.toLowerCase().includes('setting')));

  // Split title into two parts for premium display e.g. "SuperAdmin" → "Super" + "Admin"
  let titleFirst = $derived(title.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ')[0] ?? title);
  let titleRest = $derived(title.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ').slice(1).join(' '));
</script>

{#if $isSidebarOpen}
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
    onclick={() => isSidebarOpen.set(false)} 
    aria-hidden="true"
  ></div>
{/if}

<aside class="w-64 border-r border-border bg-surface h-screen flex flex-col shrink-0 transition-transform duration-300 fixed md:relative z-50 { $isSidebarOpen ? 'translate-x-0' : '-translate-x-full' } md:translate-x-0">

  <!-- Brand Header — Premium -->
  <div class="h-[72px] flex items-center gap-3.5 px-5 border-b border-border shrink-0">
    {#if logoUrl}
      <div class="w-9 h-9 rounded-xl bg-surface shadow border border-border flex items-center justify-center p-1.5 overflow-hidden shrink-0">
        <img src={logoUrl} alt="Tenant logo" class="max-w-full max-h-full object-contain" />
      </div>
    {:else}
      <!-- Geometric logo mark -->
      <div class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/30">
        <span class="text-white font-extrabold text-sm tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">
          {titleFirst.charAt(0)}{titleRest ? titleRest.charAt(0) : titleFirst.charAt(1) ?? ''}
        </span>
      </div>
    {/if}
    <div class="flex flex-col leading-tight min-w-0">
      <span class="font-extrabold text-[15px] text-foreground tracking-tight truncate" style="font-family:'Bricolage Grotesque',sans-serif; letter-spacing:-0.03em;">
        {titleFirst}{#if titleRest}<span class="text-primary">{titleRest}</span>{/if}
      </span>
    </div>
  </div>

  <!-- Main Nav -->
  <nav class="flex-1 py-5 px-3 flex flex-col gap-0.5 overflow-y-auto">

    <span class="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 px-3 mb-2">Navigation</span>

    {#each mainLinks as link}
      {@const segments = link.href.split('/').filter(Boolean).length}
      {@const isActive = $page.url.pathname === link.href || 
        (segments > 1 && $page.url.pathname.startsWith(link.href + '/'))}
      <a 
        href={link.href} 
        class="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200
          {isActive
            ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/20' 
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
      >
        <!-- Active dot indicator -->
        <span class="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200
          {isActive ? 'bg-white/70' : 'bg-border group-hover:bg-primary/50'}">
        </span>
        <span class="truncate">{link.label}</span>
        {#if isActive}
          <span class="ml-auto">
            <svg class="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
            </svg>
          </span>
        {/if}
      </a>
    {/each}
  </nav>

  <!-- Settings Footer -->
  {#if settingsLinks.length > 0}
    <div class="px-3 pb-4 pt-3 border-t border-border shrink-0 space-y-0.5">
      <span class="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 px-3 mb-2 block">Preferences</span>
      {#each settingsLinks as link}
        {@const isActive = $page.url.pathname === link.href}
        <a 
          href={link.href} 
          class="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200
            {isActive
              ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
        >
          <svg class="w-3.5 h-3.5 shrink-0 {isActive ? 'text-white/80' : 'text-muted-foreground group-hover:text-foreground'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span class="truncate">{link.label}</span>
        </a>
      {/each}
    </div>
  {/if}

</aside>
