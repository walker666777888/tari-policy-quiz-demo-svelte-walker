<script lang="ts">
  import { slide, fade } from 'svelte/transition';

  // Base list of all exam attempts
  let attempts = $state([
    { id: 201, employee: "John Doe", dept: "Finance", module: "Code of Conduct", score: 92, date: "2026-05-10", status: "Pass" },
    { id: 202, employee: "Sarah Connor", dept: "Engineering", module: "Code of Conduct", score: 95, date: "2026-05-12", status: "Pass" },
    { id: 203, employee: "Clark Kent", dept: "Operations", module: "Code of Conduct", score: 85, date: "2026-05-15", status: "Pass" },
    { id: 204, employee: "Bruce Wayne", dept: "Executive", module: "Prevention of Sexual Harassment", score: 96, date: "2026-05-14", status: "Pass" },
    { id: 205, employee: "Diana Prince", dept: "Legal", module: "Prevention of Sexual Harassment", score: 92, date: "2026-05-15", status: "Pass" },
    { id: 206, employee: "Clark Kent", dept: "Operations", module: "Conflict of Interest", score: 55, date: "2026-04-10", status: "Fail" },
    { id: 207, employee: "John Doe", dept: "Finance", module: "Conflict of Interest", score: 90, date: "2026-04-24", status: "Pass" },
    { id: 208, employee: "Barry Allen", dept: "Operations", module: "Code of Conduct", score: 90, date: "2026-05-14", status: "Pass" },
    { id: 209, employee: "Barry Allen", dept: "Operations", module: "Whistleblower Protocol", score: 88, date: "2026-03-20", status: "Pass" }
  ]);

  // Overdue Employees
  let overdueList = $state([
    { name: "Clark Kent", email: "clark@acme.corp", module: "Conflict of Interest", daysOverdue: 8, dept: "Operations" },
    { name: "Sarah Connor", email: "sarah.c@acme.corp", module: "Prevention of Sexual Harassment", daysOverdue: 3, dept: "Engineering" },
    { name: "Barry Allen", email: "barry.a@acme.corp", module: "Prevention of Sexual Harassment", daysOverdue: 3, dept: "Operations" }
  ]);

  // Telemetry indicators
  let moduleCompletions = $state([
    { code: "COC", name: "Code of Conduct", rate: 94 },
    { code: "POSH", name: "Prevention of Sexual Harassment", rate: 82 },
    { code: "COI", name: "Conflict of Interest", rate: 88 },
    { code: "WB", name: "Whistleblower Protocol", rate: 90 },
    { code: "PIT", name: "Prevention of Insider Trading", rate: 68 }
  ]);

  // Active filters
  let filterModule = $state("All");
  let filterDept = $state("All");
  let filterStatus = $state("All");

  // Notifications schedules
  let reminderSchedule = $state("7");
  let toastMessage = $state<string | null>(null);

  // Compute filtered attempts
  let filteredAttempts = $derived(
    attempts.filter(a => {
      const matchModule = filterModule === "All" || a.module === filterModule;
      const matchDept = filterDept === "All" || a.dept === filterDept;
      const matchStatus = filterStatus === "All" || a.status === filterStatus;
      return matchModule && matchDept && matchStatus;
    })
  );

  function showToast(message: string) {
    toastMessage = message;
    setTimeout(() => { toastMessage = null; }, 4000);
  }

  // Trigger Excel / PDF export
  function triggerExport(format: "Excel" | "PDF") {
    showToast(`📊 Compliance report compilation started! Downloading ${format} document...`);
  }

  // Dispatch individual email warning
  function triggerEmailReminder(name: string, email: string, moduleName: string) {
    showToast(`✉️ Email reminder dispatched successfully to ${name} (${email}) for overdue "${moduleName}" policy.`);
    // Filter out or update
    overdueList = overdueList.filter(o => !(o.email === email && o.module === moduleName));
  }

  // Trigger Bulk Reminders
  function triggerBulkReminders() {
    if (overdueList.length === 0) {
      showToast(`✨ No overdue employees remaining! All clean.`);
      return;
    }
    const count = overdueList.length;
    showToast(`⚡ Dispatched ${count} bulk compliance reminder warnings to all overdue employees!`);
    overdueList = [];
  }
</script>

<svelte:head>
  <title>Compliance Analytics & Reports - Client Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative">

  <!-- Success Notification Toast -->
  {#if toastMessage}
    <div 
      transition:slide={{axis: 'y'}}
      class="fixed top-6 right-6 z-[100] bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl px-5 py-3.5 flex items-center gap-3 max-w-sm text-xs font-semibold"
    >
      <span class="text-base">🔔</span>
      <span>{toastMessage}</span>
    </div>
  {/if}

  <!-- Header block -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Compliance Reports &amp; Analytics</h1>
      <p class="premium-heading-subtitle">Download legal compliance dossiers, audit exam attempts, and schedule automated employee reminders.</p>
    </div>
    
    <div class="flex gap-2 shrink-0">
      <button 
        onclick={() => triggerExport('PDF')}
        class="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-border bg-surface text-muted-foreground rounded-lg shadow-sm transition-all hover:bg-muted active:scale-95"
      >
        Download PDF
      </button>
      <button 
        onclick={() => triggerExport('Excel')}
        class="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-primary text-white rounded-lg shadow-md shadow-primary/10 transition-all hover:opacity-95 active:scale-95"
      >
        Export Excel Sheet
      </button>
    </div>
  </div>

  <!-- Summary Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm">
      <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Headcount</span>
      <div class="text-2xl font-extrabold text-foreground tracking-tight mt-1">142</div>
    </div>
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm">
      <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Completions</span>
      <div class="text-2xl font-extrabold text-foreground tracking-tight mt-1 text-success">120</div>
    </div>
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm">
      <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Pending Certs</span>
      <div class="text-2xl font-extrabold text-foreground tracking-tight mt-1 text-amber-500">14</div>
    </div>
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm">
      <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Failed Attempts</span>
      <div class="text-2xl font-extrabold text-foreground tracking-tight mt-1 text-destructive">8</div>
    </div>
  </div>

  <!-- Telemetry completion rates per Module -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Module-wise completion rates -->
    <div class="bg-surface rounded-xl border border-border p-6 shadow-sm lg:col-span-2 space-y-4">
      <div>
        <h3 class="text-xs font-extrabold text-foreground uppercase tracking-wider">Module Completion Coverage</h3>
        <p class="text-[10px] text-muted-foreground font-medium">Historical pass/fail rate distributions per core policy module.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {#each moduleCompletions as mc}
          <div class="bg-muted/50 border border-border p-3 rounded-lg space-y-2">
            <div class="flex justify-between items-center text-xs font-semibold text-foreground/90">
              <span class="truncate pr-2">{mc.name}</span>
              <span class="font-bold font-mono text-primary shrink-0">{mc.rate}%</span>
            </div>
            <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-1000" 
                style="width: {mc.rate}%; background-color: var(--color-primary, #0d9488);"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Notification Warning Panel -->
    <div class="bg-surface rounded-xl border border-border p-6 shadow-sm space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-xs font-extrabold text-foreground uppercase tracking-wider">Overdue Alerts</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Pending critical certifications.</p>
        </div>
        
        <button 
          onclick={triggerBulkReminders}
          class="text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded transition-all hover:bg-rose-100"
        >
          Remind All
        </button>
      </div>

      <div class="space-y-3.5 max-h-[180px] overflow-y-auto pr-1">
        {#each overdueList as od}
          <div class="flex items-center justify-between gap-3 text-xs border-b border-border/60 pb-2.5">
            <div class="min-w-0">
              <div class="font-bold text-foreground/90 truncate">{od.name}</div>
              <div class="text-[9px] text-muted-foreground font-mono truncate">{od.module}</div>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
              <span class="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-destructive/10 text-destructive border border-destructive/20 font-mono">{od.daysOverdue}d overdue</span>
              <button 
                onclick={() => triggerEmailReminder(od.name, od.email, od.module)}
                class="w-6 h-6 rounded-full bg-muted hover:bg-muted flex items-center justify-center border border-border text-muted-foreground active:scale-95 transition-all"
                title="Send compliance reminder warning email"
              >
                ✉️
              </button>
            </div>
          </div>
        {/each}
        {#if overdueList.length === 0}
          <div class="text-center text-muted-foreground py-6 text-xs font-semibold">
            🎉 All employee certifications current!
          </div>
        {/if}
      </div>

      <!-- Automated reminder schedule scheduler configuration -->
      <div class="border-t border-border pt-4 space-y-2">
        <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="autoRemind">Automatic Schedule Scheduler</label>
        <select 
          id="autoRemind"
          bind:value={reminderSchedule}
          class="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
        >
          <option value="7">Send warning 7 days before deadline</option>
          <option value="3">Send warning 3 days before deadline</option>
          <option value="1">Send warning 1 day before deadline</option>
          <option value="0">Deactivate automatic warnings</option>
        </select>
      </div>

    </div>

  </div>

  <!-- Filters Segment Card -->
  <div class="bg-surface rounded-xl border border-border shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
    
    <!-- Filter Module -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="filterMod">Module</label>
      <select 
        id="filterMod"
        bind:value={filterModule}
        class="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
      >
        <option value="All">All Modules</option>
        <option value="Code of Conduct">Code of Conduct</option>
        <option value="Prevention of Sexual Harassment">Prevention of Sexual Harassment</option>
        <option value="Conflict of Interest">Conflict of Interest</option>
        <option value="Whistleblower Protocol">Whistleblower Protocol</option>
      </select>
    </div>

    <!-- Filter Department -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="filterDep">Department</label>
      <select 
        id="filterDep"
        bind:value={filterDept}
        class="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
      >
        <option value="All">All Departments</option>
        <option value="Finance">Finance</option>
        <option value="Engineering">Engineering</option>
        <option value="Operations">Operations</option>
        <option value="Legal">Legal</option>
      </select>
    </div>

    <!-- Filter Pass / Fail Status -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="filterStat">Status</label>
      <select 
        id="filterStat"
        bind:value={filterStatus}
        class="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
      >
        <option value="All">All Statuses</option>
        <option value="Pass">Passed attempts</option>
        <option value="Fail">Failed attempts</option>
      </select>
    </div>

  </div>

  <!-- Primary attempts results log table -->
  <div class="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-muted/70 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <th class="p-4 pl-5 whitespace-nowrap">Employee</th>
            <th class="p-4 whitespace-nowrap">Department</th>
            <th class="p-4 whitespace-nowrap">Policy Module</th>
            <th class="p-4 text-center whitespace-nowrap">Score</th>
            <th class="p-4 whitespace-nowrap">Committed Date</th>
            <th class="p-4 pr-5 whitespace-nowrap">Compliance Status</th>
          </tr>
        </thead>
        <tbody class="font-medium text-muted-foreground divide-y divide-border">
          {#each filteredAttempts as attempt}
            <tr class="hover:bg-muted/50 transition-colors">
              <td class="p-4 pl-5 font-bold text-foreground whitespace-nowrap">{attempt.employee}</td>
              <td class="p-4 whitespace-nowrap">{attempt.dept}</td>
              <td class="p-4 font-semibold text-foreground/90 whitespace-nowrap">{attempt.module}</td>
              <td class="p-4 text-center font-mono font-bold text-muted-foreground whitespace-nowrap">{attempt.score}%</td>
              <td class="p-4 text-muted-foreground font-semibold whitespace-nowrap">{attempt.date}</td>
              <td class="p-4 pr-5 whitespace-nowrap">
                {#if attempt.status === 'Pass'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-success/10 border border-success/20 text-success">Pass</span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-destructive/10 border border-destructive/20 text-destructive animate-pulse">Fail</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

</div>
