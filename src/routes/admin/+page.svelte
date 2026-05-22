<script lang="ts">
  import { fade } from 'svelte/transition';

  // Setup simulated database states for Client Admin
  let stats = $state({
    totalEmployees: 142,
    complianceRate: 84.5,
    assignedModules: 5,
    completedAttempts: 468,
    totalAttempts: 520,
    overdueCount: 12
  });

  let recentEmployees = $state([
    { name: "John Doe", email: "john.doe@acme.corp", dept: "Finance", role: "General", modules: "5/5", status: "Compliant", lastActive: "2 hrs ago" },
    { name: "Sarah Connor", email: "sarah.c@acme.corp", dept: "Engineering", role: "Manager", modules: "4/5", status: "Pending", lastActive: "1 day ago" },
    { name: "Bruce Wayne", email: "bruce@acme.corp", dept: "Executive", role: "Executive", modules: "5/5", status: "Compliant", lastActive: "30 mins ago" },
    { name: "Clark Kent", email: "clark@acme.corp", dept: "Operations", role: "General", modules: "2/5", status: "At Risk", lastActive: "3 days ago" },
    { name: "Diana Prince", email: "diana.p@acme.corp", dept: "Legal", role: "Executive", modules: "5/5", status: "Compliant", lastActive: "Just now" }
  ]);

  let departmentData = $state([
    { name: "Finance", compliance: 95, total: 32 },
    { name: "Engineering", compliance: 82, total: 45 },
    { name: "Executive", compliance: 100, total: 8 },
    { name: "Operations", compliance: 68, total: 35 },
    { name: "Legal", compliance: 92, total: 22 }
  ]);
</script>

<svelte:head>
  <title>Compliance Overview - Client Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto">
  
  <!-- Header block -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Compliance Overview</h1>
      <p class="premium-heading-subtitle">Real-time health telemetry and auditor-ready compliance coverage metrics.</p>
    </div>
    <div class="flex items-center gap-2 bg-muted border border-border/50 px-3 py-1.5 rounded-lg shrink-0 text-muted-foreground font-semibold text-[11px]">
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      Acme Corp Portal Active
    </div>
  </div>

  <!-- 4 Premium Stat Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    
    <!-- Total Employees -->
    <div class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[8.5rem] sm:min-h-[9rem] relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Enrolled Employees</span>
        <div class="text-4xl font-black text-foreground tracking-tight mt-1">{stats.totalEmployees}</div>
      </div>
      <div class="text-[11px] text-muted-foreground font-semibold mt-auto flex items-center gap-1.5">
        <span class="text-emerald-500 font-bold">100%</span> active and registered employee accounts
      </div>
      <div class="absolute right-4 bottom-4 text-primary/10 group-hover:text-primary/20 group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
      </div>
    </div>

    <!-- Compliance Rate -->
    <div class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[8.5rem] sm:min-h-[9rem] relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Compliance Rate</span>
        <div class="text-4xl font-black text-foreground tracking-tight mt-1 flex items-baseline gap-1">
          {stats.complianceRate}%
        </div>
      </div>
      <div class="w-full space-y-2 mt-auto">
        <div class="h-2 w-full bg-muted rounded-full overflow-hidden relative">
          <div class="h-full bg-primary rounded-full transition-all duration-1000 relative" style="width: {stats.complianceRate}%"></div>
        </div>
        <div class="flex justify-between text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
          <span>Target: 95%</span>
          <span>Diff: -10.5%</span>
        </div>
      </div>
    </div>

    <!-- Assigned vs Completed -->
    <div class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[8.5rem] sm:min-h-[9rem] relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quiz Completions</span>
        <div class="text-4xl font-black text-foreground tracking-tight mt-1">
          {stats.completedAttempts}<span class="text-muted-foreground text-xl font-medium">/{stats.totalAttempts}</span>
        </div>
      </div>
      <div class="text-[11px] text-muted-foreground font-semibold mt-auto">
        Active: <span class="font-bold text-primary">{stats.assignedModules} company policies</span>
      </div>
      <div class="absolute right-4 bottom-4 text-emerald-500/10 group-hover:text-emerald-500/20 group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
    </div>

    <!-- Overdue Assessments -->
    <div class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[8.5rem] sm:min-h-[9rem] relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Overdue Quizzes</span>
        <div class="flex items-center gap-3 mt-1">
          <div class="text-4xl font-black text-foreground tracking-tight">{stats.overdueCount}</div>
          <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">At Risk</span>
        </div>
      </div>
      <div class="text-[11px] text-muted-foreground font-semibold mt-auto">
        Requires overdue compliance reminders
      </div>
      <div class="absolute right-4 bottom-4 text-rose-500/10 group-hover:text-rose-500/20 group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      </div>
    </div>

  </div>

  <!-- Analytics and Compliance Visualization Segment -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Department-wise Bar Chart (Svelte SVG-powered) -->
    <div class="bg-surface rounded-xl border border-border p-6 shadow-sm lg:col-span-2 flex flex-col justify-between space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-foreground">Compliance Rate by Department</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Audited completions across core operational units.</p>
        </div>
        <span class="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">Live Analytics</span>
      </div>

      <div class="space-y-4">
        {#each departmentData as dept}
          <div class="space-y-1.5">
            <div class="flex justify-between items-center text-xs font-semibold text-muted-foreground">
              <span class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-sm bg-primary" style="opacity: {dept.compliance/100}"></span>
                {dept.name} <span class="text-[9px] font-bold text-muted-foreground font-mono">({dept.total} users)</span>
              </span>
              <span class="font-bold text-foreground">{dept.compliance}%</span>
            </div>
            <div class="h-2 w-full bg-muted border border-border rounded-full overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-1000 bg-primary" 
                style="width: {dept.compliance}%;"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Compliance Donut Chart (SVG Vector Visualizer) -->
    <div class="bg-surface rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-foreground">Assessment Breakdown</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Current completion distribution.</p>
        </div>
      </div>

      <!-- Gorgeous SVG Pie Chart Representation -->
      <div class="flex items-center justify-center py-4 relative">
        <svg class="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F1F5F9" stroke-width="3"></circle>
          <!-- Compliant portion (84.5%) -->
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgb(var(--color-primary))" stroke-width="3" stroke-dasharray="84.5 15.5" stroke-dashoffset="0"></circle>
          <!-- Pending portion (10%) -->
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F59E0B" stroke-width="3" stroke-dasharray="10 90" stroke-dashoffset="-84.5"></circle>
          <!-- At Risk portion (5.5%) -->
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#DC2626" stroke-width="3" stroke-dasharray="5.5 94.5" stroke-dashoffset="-94.5"></circle>
        </svg>

        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="text-2xl font-extrabold text-foreground tracking-tight">{stats.complianceRate}%</span>
          <span class="text-[9px] font-bold text-muted-foreground uppercase">Compliant</span>
        </div>
      </div>

      <!-- Segment swatches -->
      <div class="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        <div class="space-y-0.5">
          <div class="text-[9px] font-bold text-muted-foreground uppercase flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Pass
          </div>
          <div class="text-xs font-bold text-foreground/90">84.5%</div>
        </div>
        <div class="space-y-0.5">
          <div class="text-[9px] font-bold text-muted-foreground uppercase flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pending
          </div>
          <div class="text-xs font-bold text-foreground/90">10.0%</div>
        </div>
        <div class="space-y-0.5">
          <div class="text-[9px] font-bold text-muted-foreground uppercase flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            At Risk
          </div>
          <div class="text-xs font-bold text-foreground/90">5.5%</div>
        </div>
      </div>
    </div>

  </div>

  <!-- Recent Activity Employee Table -->
  <div class="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 class="text-sm font-bold text-foreground">Operational Dashboard Overview</h3>
        <p class="text-[10px] text-muted-foreground font-medium">Top compliance audit logs and status highlights for recent employees.</p>
      </div>
      <a 
        href="/admin/employees" 
        class="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-border bg-muted text-muted-foreground rounded-lg transition-all hover:bg-muted active:scale-95 text-center shrink-0"
      >
        Manage Employees 
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
      </a>
    </div>

    <!-- Table content -->
    <div class="overflow-x-auto border border-border rounded-lg">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-muted/70 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <th class="p-3.5 pl-4 whitespace-nowrap">Employee</th>
            <th class="p-3.5 whitespace-nowrap">Department</th>
            <th class="p-3.5 whitespace-nowrap">Role Category</th>
            <th class="p-3.5 whitespace-nowrap">Modules Completed</th>
            <th class="p-3.5 whitespace-nowrap">Compliance Status</th>
            <th class="p-3.5 pr-4 whitespace-nowrap">Last Active</th>
          </tr>
        </thead>
        <tbody class="text-xs font-medium text-muted-foreground divide-y divide-border">
          {#each recentEmployees as employee}
            <tr class="hover:bg-muted/50 transition-colors duration-150">
              <td class="p-3.5 pl-4 flex items-center gap-3 whitespace-nowrap min-w-[180px]">
                <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground border border-border/50 shrink-0">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <div class="font-semibold text-foreground">{employee.name}</div>
                  <div class="text-[9px] text-muted-foreground font-mono mt-0.5">{employee.email}</div>
                </div>
              </td>
              <td class="p-3.5 whitespace-nowrap">{employee.dept}</td>
              <td class="p-3.5 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold bg-muted border border-border/40 text-muted-foreground">{employee.role}</span>
              </td>
              <td class="p-3.5 font-mono text-muted-foreground font-bold whitespace-nowrap">{employee.modules}</td>
              <td class="p-3.5 whitespace-nowrap">
                {#if employee.status === 'Compliant'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-success/10 border border-success/20 text-success">Compliant</span>
                {:else if employee.status === 'Pending'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-warning/10 border border-warning/20 text-warning">Pending</span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-destructive/10 border border-destructive/20 text-destructive animate-pulse">At Risk</span>
                {/if}
              </td>
              <td class="p-3.5 pr-4 text-muted-foreground font-semibold whitespace-nowrap">{employee.lastActive}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

</div>