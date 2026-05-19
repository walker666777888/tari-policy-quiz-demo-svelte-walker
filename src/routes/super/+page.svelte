<script lang="ts">
  // Svelte 5 Runes for fully functional dashboard sandbox
  let isSandboxActive = $state(false);
  let searchQuery = $state("");
  let selectedClientName = $state("Acme Corp Financial");
  let showModal = $state(false);

  // Form States for creating a new client
  let newName = $state("");
  let newIndustry = $state("Technology");
  let newStatus = $state<"Compliant" | "At Risk" | "Pending Review">("Compliant");

  // Dynamic sandbox database array (reactive states)
  let clientsList = $state([
    { name: 'Acme Corp Financial', industry: 'Banking', status: 'Compliant' as const, lastAssessment: 'Oct 24, 2023', sales: 98, engineering: 92, admin: 85, riskCount: 2 },
    { name: 'Globex Healthcare', industry: 'Medical', status: 'At Risk' as const, lastAssessment: 'Oct 22, 2023', sales: 74, engineering: 88, admin: 62, riskCount: 5 },
    { name: 'Initech Solutions', industry: 'Technology', status: 'Compliant' as const, lastAssessment: 'Oct 18, 2023', sales: 95, engineering: 94, admin: 90, riskCount: 0 },
    { name: 'Soylent Logistics', industry: 'Supply Chain', status: 'Pending Review' as const, lastAssessment: 'Oct 15, 2023', sales: 88, engineering: 70, admin: 75, riskCount: 1 }
  ]);

  // Derived metrics based on dynamic Sandbox state
  let totalClients = $derived(isSandboxActive ? clientsList.length : null);
  let activeTests = $derived(isSandboxActive ? clientsList.reduce((acc, c) => acc + (c.riskCount > 0 ? 3 : 1), 0) : null);
  
  let complianceRate = $derived.by(() => {
    if (!isSandboxActive) return null;
    const avg = clientsList.reduce((acc, c) => acc + ((c.sales + c.engineering + c.admin) / 3), 0) / clientsList.length;
    return Math.round(avg * 10) / 10;
  });

  // Dynamic filter for search bar
  let filteredClients = $derived(
    isSandboxActive 
      ? clientsList.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.industry.toLowerCase().includes(searchQuery.toLowerCase())) 
      : []
  );

  // Dynamic selector for in-depth client analysis
  let selectedClientData = $derived(
    clientsList.find(c => c.name === selectedClientName) || clientsList[0]
  );

  // Functional New Client Submission
  function handleAddClient(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    // Append to Svelte 5 reactive array
    clientsList = [
      ...clientsList,
      {
        name: newName,
        industry: newIndustry,
        status: newStatus,
        lastAssessment: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        sales: Math.floor(Math.random() * 20) + 80, // Dynamic simulated stats
        engineering: Math.floor(Math.random() * 25) + 75,
        admin: Math.floor(Math.random() * 30) + 70,
        riskCount: Math.floor(Math.random() * 4)
      }
    ];

    // Reset Form & Close Modal
    newName = "";
    newIndustry = "Technology";
    newStatus = "Compliant";
    showModal = false;
  }
</script>

<svelte:head>
  <title>Platform Health - Super Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-6xl mx-auto relative">
  
  <!-- Dynamic Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Platform Health</h1>
      <p class="premium-heading-subtitle">Global orchestrator dashboard and tenant health metrics.</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- 🔄 Sandbox Mode Toggle (With Rich Hover Interactions) -->
      <button 
        onclick={() => isSandboxActive = !isSandboxActive}
        class="px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center gap-2 cursor-pointer
          {isSandboxActive 
            ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' 
            : 'bg-surface text-muted-foreground border-border hover:bg-muted hover:text-foreground'}"
      >
        <span>{isSandboxActive ? '🟢 Live Sandbox: ON' : '⚫ Sandbox Mode: OFF'}</span>
      </button>
    </div>
  </div>

  <!-- Database Connection Banner -->
  <div class="p-4 rounded-xl border transition-all duration-300 hover:shadow-sm
    {isSandboxActive 
      ? 'bg-teal-500/10 border-teal-500/20' 
      : 'bg-muted border-border'}">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <!-- Pulse Indicator -->
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75
            {isSandboxActive ? 'bg-teal-400' : 'bg-slate-400'}"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 
            {isSandboxActive ? 'bg-teal-500' : 'bg-slate-500'}"></span>
        </span>
        <div>
          <div class="text-sm font-bold text-foreground">
            {isSandboxActive ? 'Connected to Preview Database Sandbox' : 'Database Connection Pending'}
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {isSandboxActive 
              ? 'Database simulation active. All search filtering, client additions, and dynamic graphs are live!' 
              : 'Supabase offline. Toggle Sandbox Mode at the top right to enable interactive controls.'}
          </p>
        </div>
      </div>
      <div class="text-[10px] font-mono px-2.5 py-1 rounded bg-surface text-muted-foreground border border-border transition-all hover:bg-muted">
        {isSandboxActive ? 'PORT: 54321 [LIVE]' : 'PORT: 54321 [AWAITING]'}
      </div>
    </div>
  </div>

  <!-- Simple Stat Cards Grid (With Elegant Lift Hover Animations) -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    
    <!-- Total Clients Card -->
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[120px] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Clients</div>
      <div class="mt-4 flex items-baseline justify-between">
        {#if totalClients !== null}
          <span class="text-3xl font-extrabold text-foreground tracking-tight animate-fade-in">{totalClients}</span>
        {:else}
          <span class="text-3xl font-light text-muted-foreground opacity-30 select-none">—</span>
        {/if}
        <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">public.tenants</span>
      </div>
    </div>

    <!-- Active Tests Card -->
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[120px] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Tests</div>
      <div class="mt-4 flex items-baseline justify-between">
        {#if activeTests !== null}
          <span class="text-3xl font-extrabold text-foreground tracking-tight animate-fade-in">{activeTests}</span>
        {:else}
          <span class="text-3xl font-light text-muted-foreground opacity-30 select-none">—</span>
        {/if}
        <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">public.assessments</span>
      </div>
    </div>

    <!-- Compliance Rate Card -->
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[120px] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Compliance Rate</div>
      <div class="mt-4 flex items-baseline justify-between">
        {#if complianceRate !== null}
          <span class="text-3xl font-extrabold text-foreground tracking-tight animate-fade-in">{complianceRate}%</span>
        {:else}
          <span class="text-3xl font-light text-muted-foreground opacity-30 select-none">—</span>
        {/if}
        <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">Global Average</span>
      </div>
    </div>

  </div>

  <!-- Recent Activity / Interactive Search -->
  <div class="bg-surface rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300">
    <div class="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <h2 class="text-sm font-bold text-foreground">Recent Clientele Activity</h2>
      
      <!-- Interactive search query binding -->
      <div class="relative w-full sm:w-64">
        <input 
          type="text" 
          bind:value={searchQuery}
          disabled={!isSandboxActive}
          placeholder="Search by name or industry..." 
          class="w-full border border-border rounded-lg pl-3 pr-10 py-1.5 text-xs bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:border-border/80" 
        />
        <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>
    </div>

    {#if isSandboxActive}
      <!-- Live Table when Sandbox is Active (With Row Slide Hovers) -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-muted text-muted-foreground uppercase font-bold tracking-wider">
            <tr>
              <th class="px-6 py-3 border-b border-border">Client Name</th>
              <th class="px-6 py-3 border-b border-border">Industry</th>
              <th class="px-6 py-3 border-b border-border">Status</th>
              <th class="px-6 py-3 border-b border-border">Last Assessment</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each filteredClients as client}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <tr 
                onclick={() => selectedClientName = client.name}
                class="cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:translate-x-0.5
                  {selectedClientName === client.name ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground'}"
              >
                <td class="px-6 py-4 font-medium">{client.name}</td>
                <td class="px-6 py-4 text-muted-foreground">{client.industry}</td>
                <td class="px-6 py-4">
                  <span class="px-2 py-0.5 text-[10px] font-bold rounded-full transition-all duration-200 hover:scale-105
                    {client.status === 'Compliant' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : ''}
                    {client.status === 'At Risk' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : ''}
                    {client.status === 'Pending Review' ? 'bg-muted text-muted-foreground border border-border' : ''}">
                    {client.status}
                  </span>
                </td>
                <td class="px-6 py-4 text-muted-foreground">{client.lastAssessment}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="4" class="px-6 py-12 text-center text-muted-foreground">
                  No matching clients found.
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <!-- Database Connection Required Empty State -->
      <div class="p-12 flex flex-col justify-center items-center text-center space-y-3 min-h-[220px]">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-all duration-300 hover:scale-110">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
        </div>
        <div class="space-y-1">
          <h3 class="text-xs font-bold text-foreground">Database Connection Required</h3>
          <p class="text-[11px] text-muted-foreground max-w-xs leading-normal">
            Connect your local Supabase database to synchronize live client records and compliance logs dynamically.
          </p>
        </div>
      </div>
    {/if}
  </div>

  <!-- In-Depth Client Analysis (Fully Functional with Live Switcher) -->
  <div class="bg-surface p-6 rounded-xl border border-border shadow-sm space-y-6 transition-all duration-300">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <h2 class="text-sm font-bold text-foreground">In-Depth Client Analysis</h2>
      
      <!-- Dynamic selector dropdown -->
      <select 
        bind:value={selectedClientName}
        disabled={!isSandboxActive}
        class="border border-border rounded-lg px-3 py-1.5 text-xs bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:border-border"
      >
        {#each clientsList as client}
          <option value={client.name}>{client.name}</option>
        {/each}
      </select>
    </div>

    {#if isSandboxActive && selectedClientData}
      <!-- Live Stats & Departmental Progress Bar Charts -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
        
        <!-- Department Pass Rates -->
        <div class="md:col-span-2 border border-border rounded-xl p-5 space-y-5 transition-all duration-300 hover:shadow-sm hover:border-border/80">
          <h3 class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Departmental Performance (Pass Rates)</h3>
          
          <div class="space-y-4">
            <div class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="font-medium text-muted-foreground transition-colors group-hover:text-primary">Sales</span>
                <span class="font-bold text-foreground">{selectedClientData.sales}%</span>
              </div>
              <div class="h-2 w-full bg-muted rounded-full overflow-hidden transition-all duration-200 group-hover:bg-muted/80">
                <div class="h-full bg-primary rounded-full transition-all duration-500 group-hover:scale-y-105" style="width: {selectedClientData.sales}%"></div>
              </div>
            </div>
            
            <div class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="font-medium text-muted-foreground transition-colors group-hover:text-primary">Engineering</span>
                <span class="font-bold text-foreground">{selectedClientData.engineering}%</span>
              </div>
              <div class="h-2 w-full bg-muted rounded-full overflow-hidden transition-all duration-200 group-hover:bg-muted/80">
                <div class="h-full bg-primary rounded-full transition-all duration-500 group-hover:scale-y-105" style="width: {selectedClientData.engineering}%"></div>
              </div>
            </div>
            
            <div class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="font-medium text-muted-foreground transition-colors group-hover:text-foreground">Admin</span>
                <span class="font-bold text-foreground">{selectedClientData.admin}%</span>
              </div>
              <div class="h-2 w-full bg-muted rounded-full overflow-hidden transition-all duration-200 group-hover:bg-muted/80">
                <div class="h-full bg-slate-400 rounded-full transition-all duration-500" style="width: {selectedClientData.admin}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Risks & Growth Grid -->
        <div class="flex flex-col gap-4">
          <!-- Critical Risk Panel -->
          <div class="p-5 rounded-xl border flex-1 flex flex-col justify-center transition-all duration-300 hover:shadow-sm
            {selectedClientData.riskCount > 0 
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:border-rose-500/35' 
              : 'bg-muted border-border text-foreground hover:border-border'}">
            <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2">
              <svg class="w-3.5 h-3.5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Compliance Risk
            </div>
            <div class="text-3xl font-extrabold text-foreground">{selectedClientData.riskCount}</div>
            <p class="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              {selectedClientData.riskCount > 0 
                ? 'Critical overdue assessments in Admin department.' 
                : 'All clear. No critical risks or overdue exams detected.'}
            </p>
          </div>

          <!-- Growth panel -->
          <div class="p-5 rounded-xl border border-border bg-surface flex-1 flex flex-col justify-center transition-all duration-300 hover:shadow-sm hover:border-border">
            <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Enrollment Growth</div>
            <div class="text-2xl font-extrabold text-foreground">
              +{selectedClientData.riskCount > 0 ? '7.2%' : '4.5%'}
            </div>
          </div>
        </div>

      </div>
    {:else}
      <!-- Offline analysis state -->
      <div class="border border-dashed border-border rounded-lg p-8 text-center min-h-[140px] flex flex-col justify-center items-center">
        <p class="text-xs text-muted-foreground">
          Select a client node from the directory to visualize departmental pass rates, risk telemetry, and enrollment growth.
        </p>
      </div>
    {/if}
  </div>

  <!-- Dynamic New Client Modal (Form Overlay) -->
  {#if showModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      onclick={() => showModal = false}
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div 
        onclick={(e) => e.stopPropagation()}
        class="bg-surface rounded-xl shadow-xl border border-border w-full max-w-md overflow-hidden transition-all duration-300"
      >
        <div class="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h3 class="text-sm font-bold text-foreground">Add New Organization Node</h3>
          <button onclick={() => showModal = false} class="text-muted-foreground hover:text-foreground font-bold text-base transition-colors hover:rotate-90 duration-200">&times;</button>
        </div>
        
        <form onsubmit={handleAddClient} class="p-6 space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="orgName">Organization Name</label>
            <input 
              id="orgName"
              type="text" 
              bind:value={newName}
              required
              placeholder="e.g. Acme Corp Financial" 
              class="w-full border border-border rounded-lg px-3 py-2 text-xs bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-border/80"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="industry">Industry Sector</label>
            <select 
              id="industry"
              bind:value={newIndustry}
              class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-surface text-foreground transition-all hover:border-border/80"
            >
              <option>Technology</option>
              <option>Banking</option>
              <option>Medical</option>
              <option>Supply Chain</option>
              <option>Retail</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="status">Compliance Status</label>
            <select 
              id="status"
              bind:value={newStatus}
              class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-surface text-foreground transition-all hover:border-border/80"
            >
              <option value="Compliant">Compliant</option>
              <option value="At Risk">At Risk</option>
              <option value="Pending Review">Pending Review</option>
            </select>
          </div>

          <div class="pt-4 border-t border-border flex justify-end gap-2.5">
            <button 
              type="button" 
              onclick={() => showModal = false}
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 hover:bg-primary/95 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Create Tenant Node
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>