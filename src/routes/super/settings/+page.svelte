<script lang="ts">
  // Svelte 5 Runes for fully functional System Settings sandbox
  let isSandboxActive = $state(false);
  let activeTab = $state<"General" | "Security" | "Database">("General");
  let showSaveToast = $state(false);

  // Dynamic sandbox settings parameters (reactive state)
  let platformName = $state("CompliancePro Enterprise");
  let sessionTimeout = $state(30); // minutes
  let registrationMode = $state<"Invite Only" | "Public">("Invite Only");
  let forceMfa = $state(true);
  let jwtExpiration = $state(3600); // seconds
  let maxLoginAttempts = $state(5);
  let dbPort = $state(54321);
  let dbSslMode = $state("require");
  let maintenanceMode = $state(false);

  // Save changes handler (fully sandbox responsive)
  function handleSaveSettings(e: SubmitEvent) {
    e.preventDefault();
    if (!isSandboxActive) return;

    // Trigger toast notification
    showSaveToast = true;
    setTimeout(() => {
      showSaveToast = false;
    }, 4000);
  }

  // Restore factory defaults
  function restoreDefaults() {
    if (!isSandboxActive) return;
    platformName = "CompliancePro Enterprise";
    sessionTimeout = 30;
    registrationMode = "Invite Only";
    forceMfa = true;
    jwtExpiration = 3600;
    maxLoginAttempts = 5;
    dbPort = 54321;
    dbSslMode = "require";
    maintenanceMode = false;

    // Toast
    showSaveToast = true;
    setTimeout(() => {
      showSaveToast = false;
    }, 3000);
  }
</script>

<svelte:head>
  <title>System Settings - Super Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-4xl mx-auto relative pb-10">

  <!-- Floating Alert Toast Notification -->
  {#if showSaveToast}
    <div class="fixed top-6 right-6 z-50 bg-teal-500 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl border border-teal-600 flex items-center gap-2 animate-fade-in transition-all">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
      <span>System Configuration saved to memory sandbox!</span>
    </div>
  {/if}
  
  <!-- Header Section -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">System Settings</h1>
      <p class="premium-heading-subtitle">Configure orchestrator parameters, authentication rules, and database gates.</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- Sandbox Mode Toggle -->
      <button 
        onclick={() => isSandboxActive = !isSandboxActive}
        class="px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-sm
          {isSandboxActive 
            ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' 
            : 'bg-surface text-muted-foreground border-border hover:bg-muted hover:border-border'}"
      >
        <span>{isSandboxActive ? '🟢 Live Sandbox: ON' : '⚫ Sandbox Mode: OFF'}</span>
      </button>

      <button 
        onclick={restoreDefaults}
        disabled={!isSandboxActive}
        class="px-4 py-2 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive border border-destructive/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-red-100/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Factory Defaults
      </button>
    </div>
  </div>

  <!-- Database Connection Banner -->
  <div class="p-4 rounded-xl border transition-all duration-300 hover:shadow-sm
    {isSandboxActive 
      ? 'bg-success/10/50 border-teal-200/60' 
      : 'bg-muted border-border/60'}">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 {isSandboxActive ? 'bg-teal-400' : 'bg-slate-400'}"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 {isSandboxActive ? 'bg-teal-500' : 'bg-slate-500'}"></span>
        </span>
        <div>
          <div class="text-sm font-bold text-foreground">
            {isSandboxActive ? 'Connected to Configuration Engine' : 'Database Connection Pending'}
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {isSandboxActive 
              ? 'Database simulation active. All setting edits, feature overrides, and platform parameters are live!' 
              : 'Supabase offline. Toggle Sandbox Mode to override orchestrator configurations from public.system_settings.'}
          </p>
        </div>
      </div>
      <div class="text-[10px] font-mono px-2.5 py-1 rounded bg-surface text-muted-foreground border border-border transition-all hover:bg-muted">
        {isSandboxActive ? 'public.system_settings [LIVE]' : 'public.system_settings [AWAITING]'}
      </div>
    </div>
  </div>

  <!-- Navigation Segments inside the page -->
  <div class="flex border-b border-border gap-1.5 overflow-x-auto">
    {#each ["General", "Security", "Database"] as tab}
      <button 
        onclick={() => activeTab = tab as any}
        class="px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 whitespace-nowrap hover:text-foreground hover:scale-105
          {activeTab === tab ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground'}"
      >
        {tab} Configuration
      </button>
    {/each}
  </div>

  <!-- Main Settings Panel (Interactive Form Layout) -->
  <div class="bg-surface rounded-xl border border-border shadow-sm p-6 sm:p-8 transition-all duration-300 hover:shadow-sm">
    <form onsubmit={handleSaveSettings} class="space-y-6">
      
      {#if activeTab === "General"}
        <div class="space-y-6 animate-fade-in">
          <div class="border-b border-border/60 pb-3">
            <h2 class="text-xs font-bold text-muted-foreground uppercase tracking-wider">General Configurations</h2>
            <p class="text-[11px] text-muted-foreground mt-1">Platform branding parameters and session governance settings.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="platformName">Platform Branding Title</label>
              <input 
                id="platformName"
                type="text" 
                bind:value={platformName}
                disabled={!isSandboxActive}
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-355"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="sessionTimeout">Session Idle Timeout (Minutes)</label>
              <input 
                id="sessionTimeout"
                type="number" 
                bind:value={sessionTimeout}
                disabled={!isSandboxActive}
                min="5" 
                max="120"
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-355"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="regMode">Client Onboarding Portal State</label>
              <select 
                id="regMode"
                bind:value={registrationMode}
                disabled={!isSandboxActive}
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-surface disabled:opacity-50 transition-all hover:border-border"
              >
                <option value="Invite Only">Invite Only (Secure Orchestrator Control)</option>
                <option value="Public">Public Access (Client Self-registration)</option>
              </select>
            </div>

            <!-- Maintenance Mode Toggle -->
            <div class="flex items-center justify-between p-4 border border-border bg-muted/50 rounded-lg group transition-all duration-200 hover:border-border hover:bg-muted">
              <div>
                <label class="text-xs font-bold text-foreground/90 select-none cursor-pointer" for="mMode">System Maintenance Mode</label>
                <p class="text-[10px] text-muted-foreground mt-0.5 leading-normal max-w-[250px]">Locks downstream admin and employee portals during upgrades.</p>
              </div>
              <input 
                id="mMode"
                type="checkbox" 
                bind:checked={maintenanceMode}
                disabled={!isSandboxActive}
                class="h-4.5 w-4.5 rounded text-primary focus:ring-primary/30 border-border disabled:opacity-50 transition-all cursor-pointer scale-105 active:scale-95"
              />
            </div>
          </div>
        </div>

      {:else if activeTab === "Security"}
        <div class="space-y-6 animate-fade-in">
          <div class="border-b border-border/60 pb-3">
            <h2 class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Identity & Security Governance</h2>
            <p class="text-[11px] text-muted-foreground mt-1">Configure multi-factor criteria and secure token lifetimes.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="jwtExp">JWT Authorization Expiration (Seconds)</label>
              <input 
                id="jwtExp"
                type="number" 
                bind:value={jwtExpiration}
                disabled={!isSandboxActive}
                step="60"
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-355"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="maxLogin">Max Failed Credentials Limit</label>
              <input 
                id="maxLogin"
                type="number" 
                bind:value={maxLoginAttempts}
                disabled={!isSandboxActive}
                min="3" 
                max="10"
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-355"
              />
            </div>

            <!-- MFA Policy -->
            <div class="flex items-center justify-between p-4 border border-border bg-muted/50 rounded-lg sm:col-span-2 group transition-all duration-200 hover:border-border hover:bg-muted">
              <div>
                <label class="text-xs font-bold text-foreground/90 select-none cursor-pointer" for="forceMFA">Enforce Multi-Factor Authentication (MFA)</label>
                <p class="text-[10px] text-muted-foreground mt-0.5 leading-normal max-w-md">Enforces authentication loops for all administrative accounts immediately upon logging in.</p>
              </div>
              <input 
                id="forceMFA"
                type="checkbox" 
                bind:checked={forceMfa}
                disabled={!isSandboxActive}
                class="h-4.5 w-4.5 rounded text-primary focus:ring-primary/30 border-border disabled:opacity-50 transition-all cursor-pointer scale-105 active:scale-95"
              />
            </div>
          </div>
        </div>

      {:else if activeTab === "Database"}
        <div class="space-y-6 animate-fade-in">
          <div class="border-b border-border/60 pb-3">
            <h2 class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Database Connection Parameters</h2>
            <p class="text-[11px] text-muted-foreground mt-1">Configure security layers and routing ports for postgres adapters.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="dbPort">Master PostgreSQL Port</label>
              <input 
                id="dbPort"
                type="number" 
                bind:value={dbPort}
                disabled={!isSandboxActive}
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-355"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-muted-foreground" for="sslMode">Database SSL Mode Connection</label>
              <select 
                id="sslMode"
                bind:value={dbSslMode}
                disabled={!isSandboxActive}
                class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-surface disabled:opacity-50 transition-all hover:border-border"
              >
                <option value="require">Require (Encrypted Loop)</option>
                <option value="disable">Disable (Unencrypted Internal Only)</option>
                <option value="verify-ca">Verify-CA (Certificate Verification)</option>
              </select>
            </div>
          </div>
        </div>
      {/if}

      <!-- Submit / Save configurations (Only Enabled in Sandbox Mode) -->
      <div class="pt-6 border-t border-border flex justify-end gap-3">
        <button 
          type="submit" 
          disabled={!isSandboxActive}
          class="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Save Configuration Node
        </button>
      </div>

    </form>
  </div>

</div>
