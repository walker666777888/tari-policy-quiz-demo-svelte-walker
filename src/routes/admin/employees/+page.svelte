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
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Employee Directory</h1>
      <p class="premium-heading-subtitle">Provision user nodes, monitor individual certification histories, and track compliant statuses.</p>
    </div>
    
    <!-- Header buttons -->
    <div class="flex items-center gap-3 shrink-0">
      
      <!-- CSV Bulk import simulation trigger -->
      <button 
        onclick={handleCsvImport}
        class="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
        disabled={csvImportingState !== 'idle'}
      >
        {#if csvImportingState === 'idle'}
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v-8m0 8l-4-4m4 4l4-4"></path></svg>
          Bulk CSV Import
        {:else if csvImportingState === 'staged'}
          <span class="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
          Parsing CSV...
        {:else}
          ✨ Success!
        {/if}
      </button>

      <!-- Add employee button -->
      <button 
        onclick={() => isAddModalOpen = true}
        class="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-primary text-white rounded-lg shadow-md shadow-primary/10 transition-all hover:opacity-95 active:scale-95"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
        Add Employee
      </button>
    </div>
  </div>

  <!-- Visual Analytics Summary Section -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    
    <!-- Chart Card 1: Compliant Activity Rings -->
    <div class="bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row gap-6 items-center">
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
          <span class="text-base font-black text-slate-800">{compliantPercent}%</span>
          <span class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Compliant</span>
        </div>
      </div>

      <div class="flex-1 space-y-3.5 w-full">
        <div>
          <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Registry Compliance Breakdown</h3>
          <p class="text-[9px] text-slate-400 font-medium">Visualizing overall tenant audit thresholds</p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span class="font-bold text-slate-600">Compliant</span>
            </div>
            <span class="font-mono font-bold text-slate-700">{compliantCount} <span class="text-slate-400 font-medium font-semibold">({compliantPercent}%)</span></span>
          </div>

          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <span class="font-bold text-slate-600">Pending Setup</span>
            </div>
            <span class="font-mono font-bold text-slate-700">{pendingCount} <span class="text-slate-400 font-medium font-semibold">({pendingPercent}%)</span></span>
          </div>

          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
              <span class="font-bold text-slate-600">At Risk</span>
            </div>
            <span class="font-mono font-bold text-slate-700">{atRiskCount} <span class="text-slate-400 font-medium font-semibold">({atRiskPercent}%)</span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Card 2: Department Compliance Overview -->
    <div class="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Department Performance Overview</h3>
        <p class="text-[9px] text-slate-400 font-medium">Compliance threshold ratios per corporate sector</p>
      </div>

      <div class="space-y-3">
        {#each deptMetrics as dept}
          <div class="space-y-1">
            <div class="flex justify-between items-center text-[10px] font-bold">
              <span class="text-slate-600">{dept.name} <span class="text-slate-400 font-medium font-mono font-semibold">({dept.count} active)</span></span>
              <span class="text-slate-700 font-mono">{dept.percent}%</span>
            </div>
            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
    
    <!-- Search -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="search">Search Employee</label>
      <input 
        id="search"
        type="text" 
        placeholder="Search by name or email..." 
        bind:value={searchQuery}
        class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-300"
      />
    </div>

    <!-- Filter Department -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="dept">Filter Department</label>
      <select 
        id="dept"
        bind:value={selectedDept}
        class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:bg-slate-100 cursor-pointer"
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
      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="status">Compliance Status</label>
      <select 
        id="status"
        bind:value={selectedStatus}
        class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:bg-slate-100 cursor-pointer"
      >
        <option value="All">All Statuses</option>
        <option value="Compliant">Compliant</option>
        <option value="Pending">Pending</option>
        <option value="At Risk">At Risk</option>
      </select>
    </div>

    <!-- Filter Employee Category -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="category">Employee Role Category</label>
      <select 
        id="category"
        bind:value={selectedCategory}
        class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:bg-slate-100 cursor-pointer"
      >
        <option value="All">All Roles</option>
        <option value="General">General Category</option>
        <option value="Manager">Manager Group</option>
        <option value="Executive">Executive Circle</option>
      </select>
    </div>

  </div>

  <!-- Primary Employees List Registry Grid -->
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th class="p-4 pl-5 whitespace-nowrap">Employee Name & Profile</th>
            <th class="p-4 whitespace-nowrap">Department</th>
            <th class="p-4 whitespace-nowrap">Category</th>
            <th class="p-4 text-center whitespace-nowrap">Modules Assigned</th>
            <th class="p-4 text-center whitespace-nowrap">Modules Completed</th>
            <th class="p-4 whitespace-nowrap">Compliance Status</th>
            <th class="p-4 pr-5 whitespace-nowrap">Last Active</th>
          </tr>
        </thead>
        <tbody class="text-xs font-semibold text-slate-600 divide-y divide-slate-100">
          {#each filteredEmployees as employee}
            <!-- Clicking row slides open the drill-down history panel -->
            <tr 
              onclick={() => selectedEmployee = employee}
              class="hover:bg-slate-50/70 cursor-pointer transition-colors duration-150 group"
            >
              <td class="p-4 pl-5 flex items-center gap-3 whitespace-nowrap min-w-[200px]">
                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200/50 group-hover:scale-105 transition-all">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <div class="font-bold text-slate-800 group-hover:text-primary transition-colors">{employee.name}</div>
                  <div class="text-[9px] text-slate-400 font-mono mt-0.5">{employee.email}</div>
                </div>
              </td>
              <td class="p-4 whitespace-nowrap">{employee.dept}</td>
              <td class="p-4 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 border border-slate-200/40 text-slate-600">{employee.role}</span>
              </td>
              <td class="p-4 text-center font-mono text-slate-500 font-bold whitespace-nowrap">{employee.assigned}</td>
              <td class="p-4 text-center font-mono text-slate-700 font-extrabold whitespace-nowrap">{employee.completed}/{employee.assigned}</td>
              <td class="p-4 whitespace-nowrap">
                {#if employee.status === 'Compliant'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 border border-emerald-100 text-emerald-600">Compliant</span>
                {:else if employee.status === 'Pending'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 border border-amber-100 text-amber-600">Pending</span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-50 border border-rose-100 text-rose-600 animate-pulse">At Risk</span>
                {/if}
              </td>
              <td class="p-4 pr-5 text-slate-400 font-semibold whitespace-nowrap">{employee.lastActive}</td>
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
        class="w-full max-w-lg bg-white h-screen shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="space-y-6">
          
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-extrabold text-primary border border-primary/20">
                {selectedEmployee.name.charAt(0)}
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-800">{selectedEmployee.name}</h3>
                <p class="text-[10px] text-slate-400 font-mono mt-0.5">{selectedEmployee.email}</p>
              </div>
            </div>
            <button 
              onclick={() => selectedEmployee = null}
              class="w-8 h-8 rounded-full bg-slate-50 border border-slate-200/50 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
            >
              ✕
            </button>
          </div>

          <!-- Metadata info cards -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center space-y-1">
              <span class="text-[9px] font-bold text-slate-400 uppercase">Department</span>
              <div class="text-xs font-bold text-slate-700">{selectedEmployee.dept}</div>
            </div>
            <div class="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center space-y-1">
              <span class="text-[9px] font-bold text-slate-400 uppercase">Role category</span>
              <div class="text-xs font-bold text-slate-700">{selectedEmployee.role} Category</div>
            </div>
          </div>

          <!-- Module Attempts Table -->
          <div class="space-y-3">
            <h4 class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Exam & Certification Log</h4>
            
            <div class="overflow-hidden border border-slate-100 rounded-lg">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-50/70 border-b border-slate-100 text-[9px] font-bold uppercase text-slate-400">
                    <th class="p-3 pl-4">Policy Module</th>
                    <th class="p-3 text-center">Score</th>
                    <th class="p-3">Completion Date</th>
                    <th class="p-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody class="font-semibold text-slate-600 divide-y divide-slate-100">
                  {#each selectedEmployee.history as hist}
                    <tr>
                      <td class="p-3 pl-4 font-semibold text-slate-800">{hist.exam}</td>
                      <td class="p-3 text-center font-mono font-bold text-slate-500">{hist.score > 0 ? `${hist.score}%` : '—'}</td>
                      <td class="p-3 text-slate-400 font-semibold">{hist.date}</td>
                      <td class="p-3 pr-4">
                        {#if hist.status === 'Pass'}
                          <span class="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Pass</span>
                        {:else if hist.status === 'Pending'}
                          <span class="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-amber-50 text-amber-600 border border-amber-100">Pending</span>
                        {:else}
                          <span class="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-rose-50 text-rose-600 border border-rose-100">Fail</span>
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
          class="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200/50 rounded-lg transition-all active:scale-[0.98]"
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
        class="bg-white rounded-xl border border-slate-200/60 shadow-2xl w-full max-w-md p-6 space-y-6"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="text-sm font-bold text-slate-800">Add New Employee Profile</h3>
          <button 
            onclick={() => isAddModalOpen = false}
            class="text-slate-400 hover:text-slate-600 font-semibold"
          >
            ✕
          </button>
        </div>

        <form onsubmit={handleAddEmployee} class="space-y-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="employeeName">Full Name *</label>
            <input 
              id="employeeName"
              type="text" 
              placeholder="e.g. Bruce Wayne" 
              bind:value={newName}
              required
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
            />
          </div>

          <!-- Email -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="employeeEmail">Work Email Address *</label>
            <input 
              id="employeeEmail"
              type="email" 
              placeholder="e.g. bruce@acme.corp" 
              bind:value={newEmail}
              required
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- Department -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="employeeDept">Department</label>
              <select 
                id="employeeDept"
                bind:value={newDept}
                class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
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
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="employeeRole">Role category</label>
              <select 
                id="employeeRole"
                bind:value={newRole}
                class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
              >
                <option value="General">General</option>
                <option value="Manager">Manager</option>
                <option value="Executive">Executive</option>
              </select>
            </div>
          </div>

          <div class="flex gap-3 border-t border-slate-100 pt-4">
            <button 
              type="button" 
              onclick={() => isAddModalOpen = false}
              class="flex-1 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-500 rounded-lg transition-all active:scale-95"
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="flex-1 py-2 bg-primary hover:opacity-95 text-xs font-bold text-white rounded-lg shadow-md shadow-primary/10 transition-all active:scale-95"
            >
              Create Account
            </button>
          </div>

        </form>
      </div>
    </div>
  {/if}

</div>
