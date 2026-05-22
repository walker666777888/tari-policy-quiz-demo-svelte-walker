<script lang="ts">
  import { slide, fade } from 'svelte/transition';

  // Base mock employees registry matching columns
  let employees = $state([
    { id: 1, name: "John Doe", email: "john.doe@acme.corp", dept: "Finance", role: "General", assigned: 5, completed: 5, status: "Compliant", lastActive: "2 hrs ago", history: [
      { exam: "Code of Conduct (COC)", score: 92, date: "May 10, 2026", status: "Pass" },
      { exam: "Prevention of Sexual Harassment (POSH)", score: 85, date: "May 08, 2026", status: "Pass" },
      { exam: "Conflict of Interest (COI)", score: 90, date: "Apr 24, 2026", status: "Pass" },
      { exam: "Prevention of Insider Trading (PIT)", score: 88, date: "Apr 18, 2026", status: "Pass" },
      { exam: "Whistleblower Protocol", score: 94, date: "Mar 12, 2026", status: "Pass" }
    ]},
    { id: 2, name: "Sarah Connor", email: "sarah.c@acme.corp", dept: "Engineering", role: "Manager", assigned: 5, completed: 4, status: "Pending", lastActive: "1 day ago", history: [
      { exam: "Code of Conduct (COC)", score: 95, date: "May 12, 2026", status: "Pass" },
      { exam: "Conflict of Interest (COI)", score: 88, date: "May 02, 2026", status: "Pass" },
      { exam: "Prevention of Insider Trading (PIT)", score: 92, date: "Apr 20, 2026", status: "Pass" },
      { exam: "Whistleblower Protocol", score: 90, date: "Mar 15, 2026", status: "Pass" },
      { exam: "Prevention of Sexual Harassment (POSH)", score: 0, date: "Not Taken", status: "Pending" }
    ]},
    { id: 3, name: "Bruce Wayne", email: "bruce@acme.corp", dept: "Executive", role: "Executive", assigned: 5, completed: 5, status: "Compliant", lastActive: "30 mins ago", history: [
      { exam: "Code of Conduct (COC)", score: 100, date: "May 18, 2026", status: "Pass" },
      { exam: "Prevention of Sexual Harassment (POSH)", score: 96, date: "May 14, 2026", status: "Pass" },
      { exam: "Conflict of Interest (COI)", score: 100, date: "Apr 28, 2026", status: "Pass" },
      { exam: "Prevention of Insider Trading (PIT)", score: 95, date: "Apr 22, 2026", status: "Pass" },
      { exam: "Whistleblower Protocol", score: 98, date: "Mar 10, 2026", status: "Pass" }
    ]},
    { id: 4, name: "Clark Kent", email: "clark@acme.corp", dept: "Operations", role: "General", assigned: 5, completed: 2, status: "At Risk", lastActive: "3 days ago", history: [
      { exam: "Code of Conduct (COC)", score: 85, date: "May 15, 2026", status: "Pass" },
      { exam: "Whistleblower Protocol", score: 90, date: "Mar 22, 2026", status: "Pass" },
      { exam: "Conflict of Interest (COI)", score: 55, date: "Apr 10, 2026", status: "Fail" },
      { exam: "Prevention of Insider Trading (PIT)", score: 0, date: "Not Taken", status: "Pending" },
      { exam: "Prevention of Sexual Harassment (POSH)", score: 0, date: "Not Taken", status: "Pending" }
    ]},
    { id: 5, name: "Diana Prince", email: "diana.p@acme.corp", dept: "Legal", role: "Executive", assigned: 5, completed: 5, status: "Compliant", lastActive: "Just now", history: [
      { exam: "Code of Conduct (COC)", score: 98, date: "May 18, 2026", status: "Pass" },
      { exam: "Prevention of Sexual Harassment (POSH)", score: 92, date: "May 15, 2026", status: "Pass" },
      { exam: "Conflict of Interest (COI)", score: 96, date: "Apr 30, 2026", status: "Pass" },
      { exam: "Prevention of Insider Trading (PIT)", score: 94, date: "Apr 25, 2026", status: "Pass" },
      { exam: "Whistleblower Protocol", score: 100, date: "Mar 18, 2026", status: "Pass" }
    ]},
    { id: 6, name: "Barry Allen", email: "barry.a@acme.corp", dept: "Operations", role: "General", assigned: 5, completed: 4, status: "Pending", lastActive: "2 days ago", history: [
      { exam: "Code of Conduct (COC)", score: 90, date: "May 14, 2026", status: "Pass" },
      { exam: "Conflict of Interest (COI)", score: 86, date: "May 06, 2026", status: "Pass" },
      { exam: "Prevention of Insider Trading (PIT)", score: 92, date: "Apr 25, 2026", status: "Pass" },
      { exam: "Whistleblower Protocol", score: 88, date: "Mar 20, 2026", status: "Pass" },
      { exam: "Prevention of Sexual Harassment (POSH)", score: 0, date: "Not Taken", status: "Pending" }
    ]}
  ]);

  // Filtering states
  let searchQuery = $state("");
  let selectedDept = $state("All");
  let selectedStatus = $state("All");
  let selectedCategory = $state("All");

  // Dynamic Metrics for SVG Charts
  let totalCount = $derived(employees.length);
  let compliantCount = $derived(employees.filter(e => e.status === 'Compliant').length);
  let pendingCount = $derived(employees.filter(e => e.status === 'Pending').length);
  let atRiskCount = $derived(employees.filter(e => e.status === 'At Risk').length);

  let compliantPercent = $derived(totalCount ? Math.round((compliantCount / totalCount) * 100) : 0);
  let pendingPercent = $derived(totalCount ? Math.round((pendingCount / totalCount) * 100) : 0);
  let atRiskPercent = $derived(totalCount ? Math.round((atRiskCount / totalCount) * 100) : 0);

  // Department-wise calculations for compliance bar chart
  const depts = ["Finance", "Engineering", "Executive", "Operations", "Legal"];
  let deptMetrics = $derived(
    depts.map(d => {
      const list = employees.filter(e => e.dept === d);
      const compliant = list.filter(e => e.status === 'Compliant').length;
      const percent = list.length ? Math.round((compliant / list.length) * 100) : 0;
      return { name: d, percent, count: list.length };
    })
  );

  // Modal / Drawer control states
  let isAddModalOpen = $state(false);
  let selectedEmployee = $state<any | null>(null);
  let csvImportingState = $state<"idle" | "staged" | "success">("idle");
  let toastMessage = $state<string | null>(null);

  // Form parameters
  let newName = $state("");
  let newEmail = $state("");
  let newDept = $state("Engineering");
  let newRole = $state("General");

  // Compute filtered employees
  let filteredEmployees = $derived(
    employees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = selectedDept === "All" || e.dept === selectedDept;
      const matchStatus = selectedStatus === "All" || e.status === selectedStatus;
      const matchCategory = selectedCategory === "All" || e.role === selectedCategory;
      return matchSearch && matchDept && matchStatus && matchCategory;
    })
  );

  // Trigger floating notification toast alerts
  function showToast(message: string) {
    toastMessage = message;
    setTimeout(() => {
      toastMessage = null;
    }, 4000);
  }

  // Handle Add Employee Submit Action
  function handleAddEmployee(e: Event) {
    e.preventDefault();
    if (!newName || !newEmail) return;

    const newEmp = {
      id: Date.now(),
      name: newName,
      email: newEmail,
      dept: newDept,
      role: newRole,
      assigned: 5,
      completed: 0,
      status: "Pending",
      lastActive: "Never active",
      history: [
        { exam: "Code of Conduct (COC)", score: 0, date: "Not Taken", status: "Pending" },
        { exam: "Prevention of Sexual Harassment (POSH)", score: 0, date: "Not Taken", status: "Pending" },
        { exam: "Conflict of Interest (COI)", score: 0, date: "Not Taken", status: "Pending" },
        { exam: "Prevention of Insider Trading (PIT)", score: 0, date: "Not Taken", status: "Pending" },
        { exam: "Whistleblower Protocol", score: 0, date: "Not Taken", status: "Pending" }
      ]
    };

    employees = [newEmp, ...employees];
    isAddModalOpen = false;

    // Reset Form
    newName = "";
    newEmail = "";
    newDept = "Engineering";
    newRole = "General";

    showToast(`✅ Employee ${newEmp.name} successfully registered & assigned modules!`);
  }

  // Simulate CSV bulk import action
  function handleCsvImport() {
    csvImportingState = "staged";
    setTimeout(() => {
      const newItems = [
        { id: Date.now() + 1, name: "Hal Jordan", email: "hal.j@acme.corp", dept: "Operations", role: "General", assigned: 5, completed: 3, status: "Pending", lastActive: "3 days ago", history: [] },
        { id: Date.now() + 2, name: "Arthur Curry", email: "aquaman@acme.corp", dept: "Legal", role: "Manager", assigned: 5, completed: 5, status: "Compliant", lastActive: "12 hrs ago", history: [] },
        { id: Date.now() + 3, name: "Victor Stone", email: "cyborg@acme.corp", dept: "Engineering", role: "General", assigned: 5, completed: 5, status: "Compliant", lastActive: "5 mins ago", history: [] }
      ];
      employees = [...employees, ...newItems];
      csvImportingState = "success";
      showToast(`📊 CSV import parsed successfully! 3 employee records imported.`);
      setTimeout(() => { csvImportingState = "idle"; }, 2000);
    }, 1200);
  }
</script>

<svelte:head>
  <title>Employee Directory - Client Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-6 max-w-7xl mx-auto relative">

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
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground transition-all duration-300" style="font-family:'Bricolage Grotesque',sans-serif;">
        Employee Directory
      </h1>
      <p class="text-sm text-muted-foreground font-medium mt-1.5 leading-relaxed max-w-2xl">
        Add and manage employee profiles, monitor individual certification histories, and track compliant statuses.
      </p>
    </div>
    
    <!-- Header buttons -->
    <div class="flex items-center gap-3 shrink-0">
      
      <!-- CSV Bulk import simulation trigger -->
      <button 
        onclick={handleCsvImport}
        class="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-border bg-surface text-muted-foreground rounded-xl shadow-sm transition-all hover:bg-muted active:scale-95 disabled:opacity-50 cursor-pointer"
        disabled={csvImportingState !== 'idle'}
      >
        {#if csvImportingState === 'idle'}
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v-8m0 8l-4-4m4 4l4-4"></path></svg>
          Bulk CSV Import
        {:else if csvImportingState === 'staged'}
          <span class="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0"></span>
          Parsing CSV...
        {:else}
          ✨ Success!
        {/if}
      </button>

      <!-- Add employee button -->
      <button 
        onclick={() => isAddModalOpen = true}
        class="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-primary text-white rounded-xl shadow-md shadow-primary/10 transition-all hover:opacity-95 active:scale-95 cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
        Add Employee
      </button>
    </div>
  </div>

  <!-- Visual Analytics Summary Section -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    
    <!-- Chart Card 1: Compliant Activity Rings -->
    <div class="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row gap-6 items-center min-h-[14rem] sm:min-h-[15rem] relative overflow-hidden group">
      <!-- Gradient top indicator bar -->
      <div class="absolute left-0 top-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"></div>

      <div class="relative w-36 h-36 flex items-center justify-center shrink-0">
        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <!-- Background track circles -->
          <circle cx="50" cy="50" r="38" stroke="#f1f5f9" stroke-width="6" fill="transparent" />
          <circle cx="50" cy="50" r="28" stroke="#f1f5f9" stroke-width="6" fill="transparent" />
          <circle cx="50" cy="50" r="18" stroke="#f1f5f9" stroke-width="6" fill="transparent" />

          <!-- Dynamic Compliant Ring (Green) -->
          <circle 
            cx="50" 
            cy="50" 
            r="38" 
            stroke="#10b981" 
            stroke-width="6" 
            fill="transparent" 
            stroke-dasharray="238.7" 
            stroke-dashoffset={238.7 - (238.7 * compliantPercent) / 100}
            stroke-linecap="round"
            class="transition-all duration-700 ease-out"
          />
          
          <!-- Dynamic Pending Ring (Amber) -->
          <circle 
            cx="50" 
            cy="50" 
            r="28" 
            stroke="#f59e0b" 
            stroke-width="6" 
            fill="transparent" 
            stroke-dasharray="175.9" 
            stroke-dashoffset={175.9 - (175.9 * pendingPercent) / 100}
            stroke-linecap="round"
            class="transition-all duration-700 ease-out"
          />

          <!-- Dynamic At Risk Ring (Rose) -->
          <circle 
            cx="50" 
            cy="50" 
            r="18" 
            stroke="#ef4444" 
            stroke-width="6" 
            fill="transparent" 
            stroke-dasharray="113.1" 
            stroke-dashoffset={113.1 - (113.1 * atRiskPercent) / 100}
            stroke-linecap="round"
            class="transition-all duration-700 ease-out"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="text-xl font-black text-foreground" style="font-family:'Bricolage Grotesque',sans-serif;">{compliantPercent}%</span>
          <span class="text-[9px] font-extrabold text-muted-foreground/95 uppercase tracking-widest mt-0.5">Compliant</span>
        </div>
      </div>

      <div class="flex-1 space-y-3.5 w-full">
        <div>
          <h3 class="text-sm font-extrabold text-foreground tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">Registry Compliance Breakdown</h3>
          <p class="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider mt-0.5">Visualizing overall tenant audit thresholds</p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span class="font-extrabold text-muted-foreground">Compliant</span>
            </div>
            <span class="font-mono font-extrabold text-foreground/90">{compliantCount} <span class="text-muted-foreground/75 font-semibold">({compliantPercent}%)</span></span>
          </div>

          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <span class="font-extrabold text-muted-foreground">Pending Setup</span>
            </div>
            <span class="font-mono font-extrabold text-foreground/90">{pendingCount} <span class="text-muted-foreground/75 font-semibold">({pendingPercent}%)</span></span>
          </div>

          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
              <span class="font-extrabold text-muted-foreground">At Risk</span>
            </div>
            <span class="font-mono font-extrabold text-foreground/90">{atRiskCount} <span class="text-muted-foreground/75 font-semibold">({atRiskPercent}%)</span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Card 2: Department Compliance Overview -->
    <div class="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4 min-h-[14rem] sm:min-h-[15rem] relative overflow-hidden group">
      <!-- Gradient top indicator bar -->
      <div class="absolute left-0 top-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-600"></div>

      <div>
        <h3 class="text-sm font-extrabold text-foreground tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">Department Performance Overview</h3>
        <p class="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider mt-0.5">Compliance threshold ratios per corporate sector</p>
      </div>

      <div class="space-y-3">
        {#each deptMetrics as dept}
          <div class="space-y-1">
            <div class="flex justify-between items-center text-xs">
              <span class="font-extrabold text-foreground/95">{dept.name} <span class="text-muted-foreground/75 font-bold font-mono text-[9px] uppercase tracking-wider ml-1">({dept.count} active)</span></span>
              <span class="text-foreground font-mono font-extrabold text-xs">{dept.percent}%</span>
            </div>
            <div class="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/10">
              <div 
                class="h-full rounded-full transition-all duration-500 ease-out 
                  {dept.percent >= 80 ? 'bg-emerald-500' : dept.percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}"
                style="width: {dept.percent}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

  </div>

  <!-- Filters Segment Card -->
  <div class="bg-surface rounded-2xl border border-border shadow-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
    
    <!-- Search -->
    <div class="space-y-1.5">
      <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="search">Search Employee</label>
      <input 
        id="search"
        type="text" 
        placeholder="Search by name or email..." 
        bind:value={searchQuery}
        class="w-full border border-border rounded-xl px-3 py-2 text-xs bg-muted/65 text-foreground/90 placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:border-border/80 duration-200"
      />
    </div>

    <!-- Filter Department -->
    <div class="space-y-1.5">
      <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="dept">Filter Department</label>
      <select 
        id="dept"
        bind:value={selectedDept}
        class="w-full border border-border rounded-xl px-2.5 py-2 text-xs bg-muted/65 text-foreground/90 font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:bg-muted/80 cursor-pointer duration-200"
      >
        <option value="All">All Departments</option>
        <option value="Finance">Finance</option>
        <option value="Engineering">Engineering</option>
        <option value="Executive">Executive</option>
        <option value="Operations">Operations</option>
        <option value="Legal">Legal</option>
      </select>
    </div>

    <!-- Filter Compliance Status -->
    <div class="space-y-1.5">
      <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="status">Compliance Status</label>
      <select 
        id="status"
        bind:value={selectedStatus}
        class="w-full border border-border rounded-xl px-2.5 py-2 text-xs bg-muted/65 text-foreground/90 font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:bg-muted/80 cursor-pointer duration-200"
      >
        <option value="All">All Statuses</option>
        <option value="Compliant">Compliant</option>
        <option value="Pending">Pending</option>
        <option value="At Risk">At Risk</option>
      </select>
    </div>

    <!-- Filter Employee Category -->
    <div class="space-y-1.5">
      <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="category">Employee Role Category</label>
      <select 
        id="category"
        bind:value={selectedCategory}
        class="w-full border border-border rounded-xl px-2.5 py-2 text-xs bg-muted/65 text-foreground/90 font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:bg-muted/80 cursor-pointer duration-200"
      >
        <option value="All">All Roles</option>
        <option value="General">General Category</option>
        <option value="Manager">Manager Group</option>
        <option value="Executive">Executive Circle</option>
      </select>
    </div>

  </div>

  <!-- Primary Employees List Registry Grid -->
  <div class="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-muted/70 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
            <th class="p-4 pl-5 whitespace-nowrap">Employee Name & Profile</th>
            <th class="p-4 whitespace-nowrap">Department</th>
            <th class="p-4 whitespace-nowrap">Category</th>
            <th class="p-4 text-center whitespace-nowrap">Modules Assigned</th>
            <th class="p-4 text-center whitespace-nowrap">Modules Completed</th>
            <th class="p-4 whitespace-nowrap">Compliance Status</th>
            <th class="p-4 pr-5 whitespace-nowrap">Last Active</th>
          </tr>
        </thead>
        <tbody class="text-xs font-semibold text-muted-foreground divide-y divide-border">
          {#each filteredEmployees as employee}
            <!-- Clicking row slides open the drill-down history panel -->
            <tr 
              onclick={() => selectedEmployee = employee}
              class="hover:bg-muted/70 cursor-pointer transition-colors duration-150 group"
            >
              <td class="py-5 px-4 pl-5 flex items-center gap-3 whitespace-nowrap min-w-[200px]">
                <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground border border-border/50 group-hover:scale-105 transition-all">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <div class="font-extrabold text-foreground group-hover:text-primary transition-colors text-sm">{employee.name}</div>
                  <div class="text-[10px] text-muted-foreground/80 font-mono mt-0.5">{employee.email}</div>
                </div>
              </td>
              <td class="py-5 px-4 whitespace-nowrap font-bold text-foreground/90">{employee.dept}</td>
              <td class="py-5 px-4 whitespace-nowrap">
                <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-muted border border-border/40 text-muted-foreground/90 tracking-wide uppercase">{employee.role}</span>
              </td>
              <td class="py-5 px-4 text-center font-mono text-muted-foreground/80 font-bold whitespace-nowrap">{employee.assigned}</td>
              <td class="py-5 px-4 text-center font-mono text-foreground font-black text-sm whitespace-nowrap">{employee.completed}<span class="text-muted-foreground/60 text-xs font-normal"> / {employee.assigned}</span></td>
              <td class="py-5 px-4 whitespace-nowrap">
                {#if employee.status === 'Compliant'}
                  <span class="px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 tracking-wider">Compliant</span>
                {:else if employee.status === 'Pending'}
                  <span class="px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-600 tracking-wider">Pending</span>
                {:else}
                  <span class="px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-rose-500/10 border border-rose-500/20 text-rose-600 tracking-wider animate-pulse">At Risk</span>
                {/if}
              </td>
              <td class="py-5 px-4 pr-5 text-muted-foreground/80 font-bold whitespace-nowrap">{employee.lastActive}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Sliding Employee Drill-down Detail History Drawer Panel -->
  {#if selectedEmployee}
    <div 
      transition:fade={{duration: 200}} 
      class="fixed inset-0 z-50 bg-slate-900/60 flex justify-end"
      onclick={() => selectedEmployee = null}
    >
      <div 
        transition:slide={{axis: 'x'}}
        class="w-full max-w-lg bg-surface h-screen shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between border-l border-border relative"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="space-y-6">
          
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-extrabold text-primary border border-primary/20 shrink-0">
                {selectedEmployee.name.charAt(0)}
              </div>
              <div>
                <h3 class="text-base font-extrabold text-foreground" style="font-family:'Bricolage Grotesque',sans-serif;">{selectedEmployee.name}</h3>
                <p class="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedEmployee.email}</p>
              </div>
            </div>
            <button 
              onclick={() => selectedEmployee = null}
              class="w-8 h-8 rounded-full bg-muted border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>

          <!-- Metadata info cards -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-muted/65 border border-border/80 p-4 rounded-xl text-center space-y-1">
              <span class="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">Department</span>
              <div class="text-sm font-extrabold text-foreground">{selectedEmployee.dept}</div>
            </div>
            <div class="bg-muted/65 border border-border/80 p-4 rounded-xl text-center space-y-1">
              <span class="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">Role category</span>
              <div class="text-sm font-extrabold text-foreground">{selectedEmployee.role} Category</div>
            </div>
          </div>

          <!-- Module Attempts Table -->
          <div class="space-y-3">
            <h4 class="text-xs font-extrabold text-foreground uppercase tracking-widest" style="font-family:'Bricolage Grotesque',sans-serif;">Assigned Exam & Certification Log</h4>
            
            <div class="overflow-hidden border border-border rounded-xl">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-muted/70 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    <th class="p-3 pl-4">Policy Module</th>
                    <th class="p-3 text-center">Score</th>
                    <th class="p-3">Completion Date</th>
                    <th class="p-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody class="font-semibold text-muted-foreground divide-y divide-border">
                  {#each selectedEmployee.history as hist}
                    <tr>
                      <td class="p-3 pl-4 font-bold text-foreground/95">{hist.exam}</td>
                      <td class="p-3 text-center font-mono font-black text-foreground">{hist.score > 0 ? `${hist.score}%` : '—'}</td>
                      <td class="p-3 text-foreground/80 font-bold">{hist.date}</td>
                      <td class="p-3 pr-4">
                        {#if hist.status === 'Pass'}
                          <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Pass</span>
                        {:else if hist.status === 'Pending'}
                          <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Pending</span>
                        {:else}
                          <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse">Fail</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Action footer -->
        <button 
          onclick={() => selectedEmployee = null}
          class="w-full text-center py-3 bg-muted hover:bg-muted/80 text-xs font-bold text-muted-foreground hover:text-foreground border border-border rounded-xl transition-all active:scale-[0.98] cursor-pointer"
        >
          Close Detail View
        </button>
      </div>
    </div>
  {/if}

  <!-- Add Employee Modal Overlay -->
  {#if isAddModalOpen}
    <div 
      transition:fade={{duration: 150}} 
      class="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      onclick={() => isAddModalOpen = false}
    >
      <div 
        transition:slide={{axis: 'y'}}
        class="bg-surface rounded-2xl border border-border/60 shadow-2xl w-full max-w-md p-6 space-y-6 relative overflow-hidden"
        onclick={(e) => e.stopPropagation()}
      >
        <!-- Gradient top indicator bar -->
        <div class="absolute left-0 top-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-600"></div>

        <div class="flex items-center justify-between border-b border-border pb-3">
          <h3 class="text-base font-extrabold text-foreground" style="font-family:'Bricolage Grotesque',sans-serif;">Add New Employee Profile</h3>
          <button 
            onclick={() => isAddModalOpen = false}
            class="text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onsubmit={handleAddEmployee} class="space-y-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="employeeName">Full Name *</label>
            <input 
              id="employeeName"
              type="text" 
              placeholder="e.g. Bruce Wayne" 
              bind:value={newName}
              required
              class="w-full border border-border rounded-xl px-3 py-2 text-xs bg-muted/65 text-foreground/90 placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:border-border/80 duration-200"
            />
          </div>

          <!-- Email -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="employeeEmail">Work Email Address *</label>
            <input 
              id="employeeEmail"
              type="email" 
              placeholder="e.g. bruce@acme.corp" 
              bind:value={newEmail}
              required
              class="w-full border border-border rounded-xl px-3 py-2 text-xs bg-muted/65 text-foreground/90 placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:border-border/80 duration-200"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- Department -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="employeeDept">Department</label>
              <select 
                id="employeeDept"
                bind:value={newDept}
                class="w-full border border-border rounded-xl px-2.5 py-2 text-xs bg-muted/65 text-foreground/90 font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm cursor-pointer transition-all duration-200 hover:bg-muted"
              >
                <option value="Engineering">Engineering</option>
                <option value="Finance">Finance</option>
                <option value="Executive">Executive</option>
                <option value="Operations">Operations</option>
                <option value="Legal">Legal</option>
              </select>
            </div>

            <!-- Role category -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest block" for="employeeRole">Role category</label>
              <select 
                id="employeeRole"
                bind:value={newRole}
                class="w-full border border-border rounded-xl px-2.5 py-2 text-xs bg-muted/65 text-foreground/90 font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm cursor-pointer transition-all duration-200 hover:bg-muted"
              >
                <option value="General">General</option>
                <option value="Manager">Manager</option>
                <option value="Executive">Executive</option>
              </select>
            </div>
          </div>

          <div class="flex gap-3 border-t border-border pt-4">
            <button 
              type="button" 
              onclick={() => isAddModalOpen = false}
              class="flex-1 py-2.5 border border-border bg-surface hover:bg-muted text-xs font-bold text-muted-foreground rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="flex-1 py-2.5 bg-primary hover:opacity-95 text-xs font-bold text-white rounded-xl shadow-md shadow-primary/10 transition-all active:scale-95 cursor-pointer"
            >
              Create Account
            </button>
          </div>

        </form>
      </div>
    </div>
  {/if}

</div>
