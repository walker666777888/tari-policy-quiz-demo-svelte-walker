<script lang="ts">
  // Svelte 5 Runes for fully functional policies sandbox
  let isSandboxActive = $state(false);
  let searchQuery = $state("");
  let selectedPolicyTitle = $state("Code of Conduct (COC)");
  let showModal = $state(false);

  // Form inputs for creating a new policy
  let newTitle = $state("");
  let newDescription = $state("");
  let newSubHeadingsInput = $state("");

  // Dynamic sandbox policies array (reactive state)
  let policiesList = $state([
    { id: 1, title: 'Code of Conduct (COC)', subHeadings: ['Professional Behavior', 'Ethical Standards', 'Operational Integrity', 'Conflict Resolution', 'Gifts and Entertainment'], questionsCount: 12, lastUpdated: 'Oct 20, 2023', description: 'Core expectations for professional behavior, ethical standards, and operational integrity.' },
    { id: 2, title: 'Conflict of Interest (COI)', subHeadings: ['Personal Investments', 'Outside Employment', 'Family Connections'], questionsCount: 8, lastUpdated: 'Oct 18, 2023', description: 'Guidelines for identifying, disclosing, and managing situations where personal interests overlap with company interests.' },
    { id: 3, title: 'Data Privacy & Security', subHeadings: ['Data Encryption', 'GDPR & HIPAA Compliance', 'System Access Controls', 'Breach Protocol'], questionsCount: 15, lastUpdated: 'Oct 15, 2023', description: 'Policies governing data encryption, employee GDPR duties, system access controls, and breach protocols.' },
    { id: 4, title: 'Anti-Bribery & Corruption', subHeadings: ['Facilitation Payments', 'Government Interactions'], questionsCount: 6, lastUpdated: 'Oct 10, 2023', description: 'Regulatory requirements prohibiting bribe offers, facilitation payments, and gifts to foreign/domestic officials.' }
  ]);

  // Derived filter for search bar
  let filteredPolicies = $derived(
    isSandboxActive 
      ? policiesList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())) 
      : []
  );

  // Derived stats
  let totalPoliciesCount = $derived(isSandboxActive ? policiesList.length : null);
  let totalSectionsCount = $derived(isSandboxActive ? policiesList.reduce((acc, p) => acc + p.subHeadings.length, 0) : null);

  // Detailed view helper
  let selectedPolicyData = $derived(
    policiesList.find(p => p.title === selectedPolicyTitle) || policiesList[0]
  );

  // Add sub-heading state
  let newSectionText = $state("");

  function handleAddPolicy(e: SubmitEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const sections = newSubHeadingsInput
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    policiesList = [
      ...policiesList,
      {
        id: policiesList.length + 1,
        title: newTitle,
        subHeadings: sections.length > 0 ? sections : ['General Provisions'],
        questionsCount: 0,
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        description: newDescription || 'No description provided.'
      }
    ];

    // Reset and close
    newTitle = "";
    newDescription = "";
    newSubHeadingsInput = "";
    showModal = false;
  }

  function handleAddSection(e: SubmitEvent) {
    e.preventDefault();
    if (!newSectionText.trim() || !selectedPolicyData) return;

    // Reactively update the subheadings of the selected policy in place
    policiesList = policiesList.map(p => {
      if (p.title === selectedPolicyData.title) {
        return {
          ...p,
          subHeadings: [...p.subHeadings, newSectionText.trim()]
        };
      }
      return p;
    });

    newSectionText = "";
  }
</script>

<svelte:head>
  <title>Policies Pool - Super Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-6xl mx-auto">
  
  <!-- Header Section -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Policies Management</h1>
      <p class="premium-heading-subtitle">Configure global master compliance policies and sections.</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- Sandbox Mode Toggle -->
      <button 
        onclick={() => isSandboxActive = !isSandboxActive}
        class="px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-sm
          {isSandboxActive 
            ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' 
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}"
      >
        <span>{isSandboxActive ? '🟢 Live Sandbox: ON' : '⚫ Sandbox Mode: OFF'}</span>
      </button>

      <button 
        onclick={() => showModal = true}
        disabled={!isSandboxActive}
        class="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + New Policy
      </button>
    </div>
  </div>

  <!-- Database Connection Banner -->
  <div class="p-4 rounded-xl border transition-all duration-300 hover:shadow-sm
    {isSandboxActive 
      ? 'bg-teal-50/50 border-teal-200/60' 
      : 'bg-slate-50 border-slate-200/60'}">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 {isSandboxActive ? 'bg-teal-400' : 'bg-slate-400'}"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 {isSandboxActive ? 'bg-teal-500' : 'bg-slate-500'}"></span>
        </span>
        <div>
          <div class="text-sm font-bold text-slate-800">
            {isSandboxActive ? 'Connected to Global Policies Registry' : 'Database Connection Pending'}
          </div>
          <p class="text-xs text-slate-500 leading-relaxed mt-0.5">
            {isSandboxActive 
              ? 'Database simulation active. All search filtering, policy additions, and sub-heading edits are live!' 
              : 'Supabase offline. Toggle Sandbox Mode to synchronize policies from public.policies & public.policy_sections.'}
          </p>
        </div>
      </div>
      <div class="text-[10px] font-mono px-2.5 py-1 rounded bg-white text-slate-500 border border-slate-200 transition-all hover:bg-slate-50">
        {isSandboxActive ? 'public.policies [LIVE]' : 'public.policies [AWAITING]'}
      </div>
    </div>
  </div>

  <!-- Stats Grid (With Micro-Lift Hovers) -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Master Policies</div>
        <div class="mt-2 text-2xl font-extrabold text-slate-900">
          {totalPoliciesCount !== null ? totalPoliciesCount : '—'}
        </div>
      </div>
      <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">public.policies</span>
    </div>
    
    <div class="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sub-Sections</div>
        <div class="mt-2 text-2xl font-extrabold text-slate-900">
          {totalSectionsCount !== null ? totalSectionsCount : '—'}
        </div>
      </div>
      <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">public.policy_sections</span>
    </div>
  </div>

  <!-- Main Split Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <!-- Policies List -->
    <div class="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 class="text-sm font-bold text-slate-800">Available Policies</h2>
        
        <input 
          type="text" 
          bind:value={searchQuery}
          disabled={!isSandboxActive}
          placeholder="Search by title or description..." 
          class="w-full sm:w-60 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-350" 
        />
      </div>

      {#if isSandboxActive}
        <div class="divide-y divide-slate-100 overflow-y-auto max-h-[450px]">
          {#each filteredPolicies as policy}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div 
              onclick={() => selectedPolicyTitle = policy.title}
              class="p-5 cursor-pointer transition-all duration-150 hover:bg-slate-50 hover:translate-x-0.5 flex flex-col gap-1.5
                {selectedPolicyTitle === policy.title ? 'bg-primary/5 border-l-2 border-primary' : ''}"
            >
              <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-slate-900">{policy.title}</span>
                <span class="text-[10px] text-slate-400">Updated: {policy.lastUpdated}</span>
              </div>
              <p class="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{policy.description}</p>
              <div class="flex gap-4 mt-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>🔗 {policy.subHeadings.length} Sub-headings</span>
                <span>❓ {policy.questionsCount} Questions</span>
              </div>
            </div>
          {:else}
            <div class="p-12 text-center text-slate-400 text-xs">
              No policies match your search.
            </div>
          {/each}
        </div>
      {:else}
        <!-- Empty State -->
        <div class="p-16 flex flex-col justify-center items-center text-center space-y-3 min-h-[300px]">
          <div class="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary transition-all duration-350 hover:scale-110">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          </div>
          <div class="space-y-1">
            <h3 class="text-xs font-bold text-slate-700">Database Connection Required</h3>
            <p class="text-[11px] text-slate-400 max-w-xs leading-normal">
              Connect your local Supabase database to synchronize live policy declarations.
            </p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Policy Sections Details -->
    <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5 transition-all duration-300 hover:shadow-sm">
      <h2 class="text-sm font-bold text-slate-800 border-b border-slate-50 pb-3">Sub-headings Detail</h2>
      
      {#if isSandboxActive && selectedPolicyData}
        <div class="space-y-4 animate-fade-in">
          <div>
            <h3 class="text-xs font-bold text-slate-800">{selectedPolicyData.title}</h3>
            <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">{selectedPolicyData.description}</p>
          </div>

          <div class="space-y-2">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Sections</h4>
            <div class="flex flex-col gap-1.5">
              {#each selectedPolicyData.subHeadings as heading, i}
                <div class="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 transition-all duration-150 hover:bg-slate-100 hover:scale-[1.01]">
                  <span class="font-bold text-[10px] text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-primary/20">{i + 1}</span>
                  <span class="truncate">{heading}</span>
                </div>
              {/each}
            </div>
          </div>

          <!-- Add Section Inline Form -->
          <form onsubmit={handleAddSection} class="pt-4 border-t border-slate-100 space-y-2">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="sectionTitle">Append Sub-heading</label>
            <div class="flex gap-2">
              <input 
                id="sectionTitle"
                type="text" 
                bind:value={newSectionText}
                required
                placeholder="e.g. Incident Reporting"
                class="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
              />
              <button type="submit" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/95 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
                Add
              </button>
            </div>
          </form>
        </div>
      {:else}
        <div class="text-center text-slate-400 text-xs py-12">
          Select a policy to manage its sections.
        </div>
      {/if}
    </div>

  </div>

  <!-- Dynamic New Policy Modal -->
  {#if showModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      onclick={() => showModal = false}
      class="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div 
        onclick={(e) => e.stopPropagation()}
        class="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden"
      >
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 class="text-sm font-bold text-slate-800">Add New Master Policy</h3>
          <button onclick={() => showModal = false} class="text-slate-400 hover:text-slate-600 font-bold text-base transition-colors hover:rotate-90 duration-200">&times;</button>
        </div>
        
        <form onsubmit={handleAddPolicy} class="p-6 space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-500" for="policyTitle">Policy Title</label>
            <input 
              id="policyTitle"
              type="text" 
              bind:value={newTitle}
              required
              placeholder="e.g. Anti-Harassment Policy" 
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-500" for="policyDesc">Description</label>
            <textarea 
              id="policyDesc"
              bind:value={newDescription}
              rows="3"
              placeholder="e.g. Core requirements regarding anti-harassment standards..." 
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm resize-none transition-all hover:border-slate-350"
            ></textarea>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-500" for="headings">Initial Sub-headings (One per line)</label>
            <textarea 
              id="headings"
              bind:value={newSubHeadingsInput}
              rows="3"
              placeholder="e.g. Reporting Incident&#10;Disciplinary Measures" 
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm resize-none bg-white transition-all hover:border-slate-350"
            ></textarea>
          </div>

          <div class="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
            <button 
              type="button" 
              onclick={() => showModal = false}
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 hover:bg-primary/95 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Create Policy Node
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>
