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
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Compliance Overview</h1>
      <p class="premium-heading-subtitle">Real-time health telemetry and auditor-ready compliance coverage metrics.</p>
    </div>
    <div class="flex items-center gap-2 bg-slate-50 border border-slate-200/50 px-3 py-1.5 rounded-lg shrink-0 text-slate-500 font-semibold text-[11px]">
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      Tenant Workspace Active
    </div>
  </div>

  <!-- 4 Premium Stat Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    
    <!-- Total Employees -->
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Enrolled Employees</span>
        <div class="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">{stats.totalEmployees}</div>
      </div>
      <div class="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
        <span class="text-emerald-500 font-bold">100%</span> actively licensed nodes
      </div>
      <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 opacity-20 group-hover:scale-110 transition-transform">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
      </div>
    </div>

    <!-- Compliance Rate -->
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Compliance Rate</span>
        <div class="text-3xl font-extrabold text-slate-800 tracking-tight mt-1 flex items-baseline gap-1">
          {stats.complianceRate}%
        </div>
      </div>
      <div class="w-full space-y-1">
        <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all duration-1000" style="width: {stats.complianceRate}%"></div>
        </div>
        <div class="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
          <span>Target: 95%</span>
          <span>Diff: -10.5%</span>
        </div>
      </div>
    </div>

    <!-- Assigned vs Completed -->
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Task Progress</span>
        <div class="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">
          {stats.completedAttempts}<span class="text-slate-400 text-lg font-medium">/{stats.totalAttempts}</span>
        </div>
      </div>
      <div class="text-[11px] text-slate-500 font-medium">
        Active Modules: <span class="font-bold text-primary">{stats.assignedModules} policies</span>
      </div>
      <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 opacity-20 group-hover:scale-110 transition-transform">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
    </div>

    <!-- Overdue Assessments -->
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue Assessments</span>
        <div class="flex items-center gap-3 mt-1">
          <div class="text-3xl font-extrabold text-slate-800 tracking-tight">{stats.overdueCount}</div>
          <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-rose-50 border border-rose-100 text-rose-600 animate-pulse">At Risk</span>
        </div>
      </div>
      <div class="text-[11px] text-slate-500 font-medium">
        Requires urgent reminder triggers
      </div>
      <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 opacity-20 group-hover:scale-110 transition-transform">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      </div>
    </div>

  </div>

  <!-- Analytics and Compliance Visualization Segment -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Department-wise Bar Chart (Svelte SVG-powered) -->
    <div class="bg-white rounded-xl border border-slate-100 p-6 shadow-sm lg:col-span-2 flex flex-col justify-between space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Compliance Rate by Department</h3>
          <p class="text-[10px] text-slate-400 font-medium">Audited completions across core operational units.</p>
        </div>
        <span class="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">Live Analytics</span>
      </div>

      <div class="space-y-4">
        {#each departmentData as dept}
          <div class="space-y-1.5">
            <div class="flex justify-between items-center text-xs font-semibold text-slate-600">
              <span class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-sm bg-primary" style="opacity: {dept.compliance/100}"></span>
                {dept.name} <span class="text-[9px] font-bold text-slate-400 font-mono">({dept.total} users)</span>
              </span>
              <span class="font-bold text-slate-800">{dept.compliance}%</span>
            </div>
            <div class="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
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
    <div class="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Assessment Breakdown</h3>
          <p class="text-[10px] text-slate-400 font-medium">Current completion distribution.</p>
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
          <span class="text-2xl font-extrabold text-slate-800 tracking-tight">{stats.complianceRate}%</span>
          <span class="text-[9px] font-bold text-slate-400 uppercase">Compliant</span>
        </div>
      </div>

      <!-- Segment swatches -->
      <div class="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
        <div class="space-y-0.5">
          <div class="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Pass
          </div>
          <div class="text-xs font-bold text-slate-700">84.5%</div>
        </div>
        <div class="space-y-0.5">
          <div class="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pending
          </div>
          <div class="text-xs font-bold text-slate-700">10.0%</div>
        </div>
        <div class="space-y-0.5">
          <div class="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            At Risk
          </div>
          <div class="text-xs font-bold text-slate-700">5.5%</div>
        </div>
      </div>
    </div>

  </div>

  <!-- Recent Activity Employee Table -->
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 class="text-sm font-bold text-slate-800">Operational Dashboard Overview</h3>
        <p class="text-[10px] text-slate-400 font-medium">Top compliance audit logs and status highlights for recent employees.</p>
      </div>
      <a 
        href="/admin/employees" 
        class="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-slate-200 bg-slate-50 text-slate-600 rounded-lg transition-all hover:bg-slate-100 active:scale-95 text-center shrink-0"
      >
        Manage Employees 
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
      </a>
    </div>

    <!-- Table content -->
    <div class="overflow-x-auto border border-slate-100 rounded-lg">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th class="p-3.5 pl-4 whitespace-nowrap">Employee</th>
            <th class="p-3.5 whitespace-nowrap">Department</th>
            <th class="p-3.5 whitespace-nowrap">Role Category</th>
            <th class="p-3.5 whitespace-nowrap">Modules Completed</th>
            <th class="p-3.5 whitespace-nowrap">Compliance Status</th>
            <th class="p-3.5 pr-4 whitespace-nowrap">Last Active</th>
          </tr>
        </thead>
        <tbody class="text-xs font-medium text-slate-600 divide-y divide-slate-100">
          {#each recentEmployees as employee}
            <tr class="hover:bg-slate-50/50 transition-colors duration-150">
              <td class="p-3.5 pl-4 flex items-center gap-3 whitespace-nowrap min-w-[180px]">
                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200/50 shrink-0">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <div class="font-semibold text-slate-800">{employee.name}</div>
                  <div class="text-[9px] text-slate-400 font-mono mt-0.5">{employee.email}</div>
                </div>
              </td>
              <td class="p-3.5 whitespace-nowrap">{employee.dept}</td>
              <td class="p-3.5 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 border border-slate-200/40 text-slate-600">{employee.role}</span>
              </td>
              <td class="p-3.5 font-mono text-slate-500 font-bold whitespace-nowrap">{employee.modules}</td>
              <td class="p-3.5 whitespace-nowrap">
                {#if employee.status === 'Compliant'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 border border-emerald-100 text-emerald-600">Compliant</span>
                {:else if employee.status === 'Pending'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 border border-amber-100 text-amber-600">Pending</span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-50 border border-rose-100 text-rose-600 animate-pulse">At Risk</span>
                {/if}
              </td>
              <td class="p-3.5 pr-4 text-slate-400 font-semibold whitespace-nowrap">{employee.lastActive}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

</div>