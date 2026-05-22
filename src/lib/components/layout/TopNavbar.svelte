<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  import { isDarkMode, toggleTheme } from '$lib/stores/themeMode';
  import { isSidebarOpen } from '$lib/stores/sidebar';

  let { showSearch = false, showSidebarToggle = false, children } = $props<{ showSearch?: boolean; showSidebarToggle?: boolean; children?: import('svelte').Snippet }>();

  // Dropdown States
  let showNotifications = $state(false);
  let showUserMenu = $state(false);

  // Dynamic User Profile based on Context Path
  let userProfile = $derived.by(() => {
    const path = $page.url.pathname;
    if (path.startsWith('/super')) {
      return {
        role: "Super Admin",
        name: "System Controller",
        email: "super@compliancepro.com",
        initials: "SA",
        profileHref: "/super/settings",
        settingsHref: "/super/settings"
      };
    } else if (path.startsWith('/admin')) {
      return {
        role: "Client Admin",
        name: "Globex HR Manager",
        email: "admin@globex.com",
        initials: "CA",
        profileHref: "/admin/settings",
        settingsHref: "/admin/settings"
      };
    } else {
      return {
        role: "Employee",
        name: "John Doe",
        email: "john.doe@acme.corp",
        initials: "JD",
        profileHref: "/dashboard/profile",
        settingsHref: "/dashboard/profile"
      };
    }
  });

  // Dynamic Notifications based on Context Path
  let notifications = $state<Array<{ id: number, text: string, time: string, unread: boolean }>>([]);

  $effect(() => {
    const path = $page.url.pathname;
    if (path.startsWith('/super')) {
      notifications = [
        { id: 1, text: "System Health: All PostgreSQL server connections are running securely under 15ms.", time: "10 mins ago", unread: true },
        { id: 2, text: "Workspace Provisioned: Globex Healthcare successfully deployed.", time: "2 hours ago", unread: false }
      ];
    } else if (path.startsWith('/admin')) {
      notifications = [
        { id: 1, text: "Compliance Alert: 3 executives are overdue on the Cyber Security protocol exam.", time: "1 hour ago", unread: true },
        { id: 2, text: "Bulk Import: Successfully processed and validated employee list upload.", time: "1 day ago", unread: false }
      ];
    } else {
      notifications = [
        { id: 1, text: "Required Exam: Insider Trading Prevention module is due in 3 days.", time: "45 mins ago", unread: true },
        { id: 2, text: "Certificate Issued: Your Conflict of Interest certificate is now active.", time: "1 day ago", unread: false }
      ];
    }
  });

  let unreadCount = $derived(notifications.filter(n => n.unread).length);

  function markAllAsRead() {
    notifications = notifications.map(n => ({ ...n, unread: false }));
  }

  function handleSignOut() {
    showUserMenu = false;
    goto('/login');
  }
</script>

<!-- Close dropdowns when clicking outside -->
<svelte:window onclick={(e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.bell-btn') && !target.closest('.bell-dropdown') && !target.closest('.theme-btn')) {
    showNotifications = false;
  }
  if (!target.closest('.avatar-btn') && !target.closest('.avatar-dropdown') && !target.closest('.theme-btn')) {
    showUserMenu = false;
  }
}} />

<header class="h-[72px] md:h-[76px] border-b border-border bg-surface flex items-center justify-between px-4 md:px-8 shrink-0 relative z-40 transition-all duration-300 gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
  <div class="flex items-center gap-3 md:gap-8 flex-1 min-w-0">
    {#if showSidebarToggle}
      <button 
        class="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        onclick={() => isSidebarOpen.update(v => !v)}
        aria-label="Toggle Sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
      </button>
    {/if}

    {#if children}
      {@render children()}
    {:else if showSearch}
      <div class="relative w-full max-w-[140px] sm:max-w-[240px]">
        <input type="text" placeholder="Search..." class="input-enterprise w-full pl-9" />
        <span class="absolute left-3 top-2.5 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-1 sm:gap-4 relative shrink-0">
    
    <!-- Dark Mode Toggle Button -->
    <button 
      onclick={toggleTheme}
      class="theme-btn p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center"
      aria-label="Toggle theme mode"
    >
      {#if $isDarkMode}
        <!-- Moon Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400 animate-[spin_10s_linear_infinite]"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      {:else}
        <!-- Sun Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground hover:text-amber-500 transition-colors"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      {/if}
    </button>

    <!-- Bell Button -->
    <button 
      onclick={() => { showNotifications = !showNotifications; showUserMenu = false; }}
      class="bell-btn p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 relative rounded-full hover:bg-muted" 
      aria-label="View notifications"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      {#if unreadCount > 0}
        <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface animate-pulse"></span>
      {/if}
    </button>

    <!-- Bell Dropdown (Enterprise Design) -->
    {#if showNotifications}
      <div 
        transition:fade={{ duration: 150 }}
        class="bell-dropdown absolute right-0 sm:right-10 top-12 w-[300px] sm:w-80 max-w-[calc(100vw-1rem)] bg-surface rounded-xl border border-border shadow-2xl z-50 overflow-hidden flex flex-col transition-all duration-300"
      >
        <div class="p-3.5 bg-muted border-b border-border flex items-center justify-between">
          <span class="text-[11px] font-bold text-foreground uppercase tracking-wider">Alert Center</span>
          {#if unreadCount > 0}
            <button onclick={markAllAsRead} class="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors">
              Mark all read
            </button>
          {/if}
        </div>
        
        <div class="divide-y divide-border max-h-64 overflow-y-auto">
          {#each notifications as note}
            <div class="p-3.5 hover:bg-muted/50 transition-colors flex gap-2.5 items-start">
              {#if note.unread}
                <span class="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
              {/if}
              <div class="space-y-1">
                <p class="text-xs text-foreground leading-normal font-medium">{note.text}</p>
                <span class="text-[9px] text-muted-foreground font-bold block">{note.time}</span>
              </div>
            </div>
          {/each}
        </div>
        
        <div class="p-2.5 bg-muted border-t border-border text-center shrink-0">
          <span class="text-[10px] text-muted-foreground font-bold uppercase">{userProfile.role} Auditable Logs</span>
        </div>
      </div>
    {/if}

    <!-- Avatar Button -->
    <button 
      onclick={() => { showUserMenu = !showUserMenu; showNotifications = false; }}
      class="avatar-btn h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary flex items-center justify-center font-bold text-[15px] text-white shadow-sm border border-black/5 shrink-0 transition-all duration-200 transform hover:scale-105"
    >
      {userProfile.initials}
    </button>

    <!-- Avatar Dropdown (Enterprise Design) -->
    {#if showUserMenu}
      <div 
        transition:fade={{ duration: 150 }}
        class="avatar-dropdown absolute right-0 top-12 w-56 sm:w-60 max-w-[calc(100vw-1rem)] bg-surface rounded-2xl border border-border shadow-2xl z-50 overflow-hidden flex flex-col py-1.5 transition-all duration-300"
      >
        <!-- Header Info -->
        <div class="px-5 py-3.5 border-b border-border bg-muted/40 flex flex-col">
          <div class="text-sm font-extrabold text-foreground tracking-tight">{userProfile.name}</div>
          <div class="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">{userProfile.email}</div>
          <div class="mt-2.5">
            <span class="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
              {userProfile.role}
            </span>
          </div>
        </div>

        <!-- Links List -->
        <div class="py-1 flex flex-col gap-0.5">
          <a 
            href={userProfile.profileHref}
            onclick={() => showUserMenu = false}
            class="flex items-center gap-2.5 px-5 py-2.5 text-[13px] text-foreground hover:bg-muted font-semibold transition-all"
          >
            <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            My Profile
          </a>
          {#if userProfile.role !== 'Employee'}
            <a 
              href={userProfile.settingsHref}
              onclick={() => showUserMenu = false}
              class="flex items-center gap-2.5 px-5 py-2.5 text-[13px] text-foreground hover:bg-muted font-semibold transition-all"
            >
              <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              System Settings
            </a>
          {/if}
        </div>

        <!-- Sign Out Segment -->
        <div class="border-t border-border pt-1.5 mt-1">
          <button 
            onclick={handleSignOut}
            class="flex items-center gap-2.5 w-full text-left px-5 py-3 text-[13px] text-rose-500 hover:bg-rose-950/20 hover:text-rose-400 font-bold transition-all"
          >
            <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sign Out
          </button>
        </div>
      </div>
    {/if}
  </div>
</header>