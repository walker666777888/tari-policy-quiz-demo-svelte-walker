<script lang="ts">
  // Svelte 5 Runes for fully functional Audit Logs sandbox
  let isSandboxActive = $state(false);
  let searchQuery = $state("");
  let severityFilter = $state<"All" | "Info" | "Warning" | "Alert">("All");

  // Dynamic audit logs array (reactive state)
  let logsList = $state([
    { id: 'log-101', timestamp: '2023-10-24 14:32:15', actor: 'Super Admin (System)', action: 'Provisioned Tenant', target: 'Soylent Logistics', severity: 'Info' as const },
    { id: 'log-102', timestamp: '2023-10-23 09:15:42', actor: 'Sarah Connor (Acme)', action: 'Created Assessment', target: 'Data Security COC', severity: 'Info' as const },
    { id: 'log-103', timestamp: '2023-10-22 17:04:11', actor: 'Bill Lumbergh (Initech)', action: 'Failed Login Attempt', target: 'Auth Gate', severity: 'Warning' as const },
    { id: 'log-104', timestamp: '2023-10-21 11:22:09', actor: 'System Daemon', action: 'Began Global Compliance Backup', target: 'Postgres DB', severity: 'Info' as const },
    { id: 'log-105', timestamp: '2023-10-20 08:33:51', actor: 'Robert Neville (Soylent)', action: 'Role Update Bypass Attempt', target: 'RLS Policy Deny', severity: 'Alert' as const }
  ]);

  // Derived filtered logs list
  let filteredLogs = $derived(
    isSandboxActive
      ? logsList.filter(l => {
          const matchesSearch = l.actor.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                l.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                l.target.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesSeverity = severityFilter === "All" || l.severity === severityFilter;
          return matchesSearch && matchesSeverity;
        })
      : []
  );

  // Derived counts
  let totalLogsCount = $derived(isSandboxActive ? logsList.length : null);
  let warningCount = $derived(isSandboxActive ? logsList.filter(l => l.severity === "Warning" || l.severity === "Alert").length : null);

  // Simulated Audit Actions list to choose from randomly
  const mockActions = [
    { actor: 'Sarah Connor (Acme)', action: 'Dispatched PDF Report', target: 'Acme Q3 Compliance Audit', severity: 'Info' as const },
    { actor: 'System Daemon', action: 'SSL Certificate Renewal', target: 'Gateway Endpoint', severity: 'Info' as const },
    { actor: 'Bill Lumbergh (Initech)', action: 'Modified Exam Rule Override', target: 'COI Questionnaire', severity: 'Warning' as const },
    { actor: 'Super Admin (System)', action: 'Updated Global RLS Policy', target: 'public.master_questions', severity: 'Alert' as const }
  ];

  // Trigger a fresh live sandbox log entry
  function triggerMockEvent() {
    const randomAction = mockActions[Math.floor(Math.random() * mockActions.length)];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Prepend reactively in Svelte 5
    logsList = [
      {
        id: `log-${Date.now()}`,
        timestamp: timestampStr,
        ...randomAction
      },
      ...logsList
    ];
  }

  // Clear all sandbox logs
  function clearLogsStream() {
    logsList = [];
  }
</script>

<svelte:head>
  <title>Security Auditing - Super Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-6xl mx-auto">
  
  <!-- Header Section -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Audit Logs</h1>
      <p class="premium-heading-subtitle">Platform-wide audit trail, system exceptions, and security events.</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- Sandbox Mode Toggle -->
      <button 
        onclick={() => isSandboxActive = !isSandboxActive}
        class="px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center gap-2
          {isSandboxActive 
            ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' 
            : 'bg-surface text-muted-foreground border-border hover:bg-muted hover:border-border'}"
      >
        <span>{isSandboxActive ? '🟢 Live Sandbox: ON' : '⚫ Sandbox Mode: OFF'}</span>
      </button>

      <!-- Sandbox Event Generator -->
      <button 
        onclick={triggerMockEvent}
        disabled={!isSandboxActive}
        class="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ⚡ Trigger Log Event
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
            {isSandboxActive ? 'Connected to Global System Audit Stream' : 'Database Connection Pending'}
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {isSandboxActive 
              ? 'Database simulation active. Global security streams, incident counters, and log resets are live!' 
              : 'Supabase offline. Toggle Sandbox Mode to monitor compliance security operations from public.audit_logs.'}
          </p>
        </div>
      </div>
      <div class="text-[10px] font-mono px-2.5 py-1 rounded bg-surface text-muted-foreground border border-border transition-all hover:bg-muted">
        {isSandboxActive ? 'public.audit_logs [LIVE]' : 'public.audit_logs [AWAITING]'}
      </div>
    </div>
  </div>

  <!-- Incident & Stats Grid (With Micro-Lift Hovers) -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Recorded Events</div>
        <div class="mt-2 text-2xl font-extrabold text-foreground">
          {totalLogsCount !== null ? totalLogsCount : '—'}
        </div>
      </div>
      <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">Logs Count</span>
    </div>
    
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Anomalies & Warnings</div>
        <div class="mt-2 text-2xl font-extrabold text-red-600">
          {warningCount !== null ? warningCount : '—'}
        </div>
      </div>
      <span class="text-[10px] font-medium text-red-600 bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 transition-colors duration-200 hover:bg-red-100">Critical Warnings</span>
    </div>
  </div>

  <!-- Audit Stream Grid -->
  <div class="bg-surface rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-sm">
    <!-- Stream Controls Toolbar -->
    <div class="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-bold text-foreground">Security Audit Stream</h2>
        {#if isSandboxActive}
          <button 
            onclick={clearLogsStream}
            class="text-[10px] font-bold text-red-600 bg-destructive/10 hover:bg-red-100 border border-destructive/20 rounded px-2 py-0.5 transition-colors duration-200 hover:scale-105"
          >
            Clear Stream
          </button>
        {/if}
      </div>
      
      <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <!-- Search -->
        <input 
          type="text" 
          bind:value={searchQuery}
          disabled={!isSandboxActive}
          placeholder="Search logs..." 
          class="border border-border rounded-lg px-3 py-1.5 text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 w-full sm:w-48 transition-all hover:border-border" 
        />

        <!-- Severity Filter Selector -->
        <select 
          bind:value={severityFilter}
          disabled={!isSandboxActive}
          class="border border-border rounded-lg px-3 py-1.5 text-[11px] bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-border"
        >
          <option value="All">All Severities</option>
          <option value="Info">Info Only</option>
          <option value="Warning">Warnings</option>
          <option value="Alert">Alerts</option>
        </select>
      </div>
    </div>

    {#if isSandboxActive}
      <!-- Live Auditing Table (With Row Slide Micro-Animations) -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-muted text-muted-foreground uppercase font-bold tracking-wider">
            <tr>
              <th class="px-6 py-3 border-b border-border">Timestamp</th>
              <th class="px-6 py-3 border-b border-border">Actor</th>
              <th class="px-6 py-3 border-b border-border">Action Event</th>
              <th class="px-6 py-3 border-b border-border">Target Node</th>
              <th class="px-6 py-3 border-b border-border">Severity</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each filteredLogs as log}
              <tr class="hover:bg-muted/80 transition-all duration-150 hover:translate-x-0.5 text-foreground/90">
                <td class="px-6 py-4 text-muted-foreground font-mono">{log.timestamp}</td>
                <td class="px-6 py-4 text-foreground font-semibold">{log.actor}</td>
                <td class="px-6 py-4 text-muted-foreground">{log.action}</td>
                <td class="px-6 py-4 text-muted-foreground font-mono">{log.target}</td>
                <td class="px-6 py-4">
                  <span class="px-2 py-0.5 text-[9px] font-bold rounded-full transition-all duration-200 hover:scale-105 inline-block
                    {log.severity === 'Info' ? 'bg-muted text-muted-foreground border border-border/50' : ''}
                    {log.severity === 'Warning' ? 'bg-warning/10 text-amber-700 border border-warning/20/50' : ''}
                    {log.severity === 'Alert' ? 'bg-destructive/10 text-destructive border border-destructive/20/50' : ''}">
                    {log.severity}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <!-- Empty State -->
      <div class="p-16 flex flex-col justify-center items-center text-center space-y-3 min-h-[300px]">
        <div class="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary transition-all duration-350 hover:scale-110">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <div class="space-y-1">
          <h3 class="text-xs font-bold text-foreground/90">Database Connection Required</h3>
          <p class="text-[11px] text-muted-foreground max-w-xs leading-normal">
            Connect your local Supabase database to synchronize live global compliance audit streams.
          </p>
        </div>
      </div>
    {/if}
  </div>

</div>
