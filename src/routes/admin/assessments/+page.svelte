<script lang="ts">
  import { slide, fade } from 'svelte/transition';

  // Base list of corporate policy modules
  let modules = $state([
    { id: "coc", code: "COC", name: "Code of Conduct", desc: "Foundational guide establishing professional integrity, company values, and compliance standards.", active: true, assignedTo: ["General", "Manager", "Executive"], deadline: "2026-06-30" },
    { id: "posh", code: "POSH", name: "Prevention of Sexual Harassment", desc: "Critical legal compliance training for maintaining safe, respectful, and harassment-free work environments.", active: true, assignedTo: ["General", "Manager", "Executive"], deadline: "2026-07-15" },
    { id: "coi", code: "COI", name: "Conflict of Interest", desc: "Guidance on identifying, disclosing, and ethically managing potential personal vs corporate conflicts.", active: true, assignedTo: ["Manager", "Executive"], deadline: "2026-06-15" },
    { id: "pit", code: "PIT", name: "Prevention of Insider Trading", desc: "Essential governance module covering market ethics, disclosure rules, and strict trading embargoes.", active: false, assignedTo: ["Executive"], deadline: "2026-08-01" },
    { id: "wb", code: "WB", name: "Whistleblower Protocol", desc: "Operational guide detailing reporting pathways, retaliation shield policies, and internal investigations.", active: true, assignedTo: ["General", "Manager"], deadline: "2026-05-30" }
  ]);

  // Simulated live assignments logs
  let assignmentsLog = $state([
    { id: 101, module: "Code of Conduct", target: "All Employees", deadline: "June 30, 2026", status: "Active" },
    { id: 102, module: "Prevention of Sexual Harassment", target: "All Employees", deadline: "July 15, 2026", status: "Active" },
    { id: 103, module: "Conflict of Interest", target: "Manager & Above", deadline: "June 15, 2026", status: "Active" },
    { id: 104, module: "Whistleblower Protocol", target: "General & Manager", deadline: "May 30, 2026", status: "Active" }
  ]);

  // Modal control states
  let isAssignModalOpen = $state(false);
  let toastMessage = $state<string | null>(null);

  // Assignment form states
  let selectedModuleId = $state("coc");
  let targetGroup = $state("General");
  let customDeadline = $state("2026-08-31");

  function showToast(message: string) {
    toastMessage = message;
    setTimeout(() => { toastMessage = null; }, 4000);
  }

  // Toggle Module status
  function toggleModule(id: string) {
    modules = modules.map(m => {
      if (m.id === id) {
        const nextState = !m.active;
        showToast(`🔔 Policy module "${m.name}" has been ${nextState ? 'ENABLED' : 'DISABLED'} for your company.`);
        return { ...m, active: nextState };
      }
      return m;
    });
  }

  // Handle module assignment creation
  function handleCreateAssignment(e: Event) {
    e.preventDefault();
    const targetModule = modules.find(m => m.id === selectedModuleId);
    if (!targetModule) return;

    // Check if module is active first
    if (!targetModule.active) {
      showToast(`⚠️ Cannot assign: "${targetModule.name}" is currently deactivated. Please enable it first!`);
      isAssignModalOpen = false;
      return;
    }

    // Format target group label
    let groupLabel = targetGroup === "All" ? "All Employees" : `${targetGroup} Group`;
    
    // Format date nicely
    const dateParts = customDeadline.split('-');
    const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Insert to log
    const newLog = {
      id: Date.now(),
      module: targetModule.name,
      target: groupLabel,
      deadline: formattedDate,
      status: "Active"
    };

    assignmentsLog = [newLog, ...assignmentsLog];
    isAssignModalOpen = false;

    // Update the modules list as well
    modules = modules.map(m => {
      if (m.id === selectedModuleId) {
        let currentAssigned = [...m.assignedTo];
        if (!currentAssigned.includes(targetGroup)) {
          currentAssigned.push(targetGroup);
        }
        return { ...m, assignedTo: currentAssigned, deadline: customDeadline };
      }
      return m;
    });

    showToast(`🚀 Newly assigned "${targetModule.name}" policy to ${groupLabel} successfully!`);
  }
</script>

<svelte:head>
  <title>Policy & Module Assignment - Client Admin | CompliancePro</title>
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
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Policy &amp; Module Assignment</h1>
      <p class="premium-heading-subtitle">Activate organizational governance standards, target compliance categories, and establish hard auditor deadlines.</p>
    </div>
    
    <button 
      onclick={() => isAssignModalOpen = true}
      class="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-primary text-white rounded-lg shadow-md shadow-primary/10 transition-all hover:opacity-95 active:scale-95 shrink-0"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
      Assign New Module
    </button>
  </div>

  <!-- Available Policy Modules Card Directory -->
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Corporate Policy Library</h3>
      <span class="text-[10px] text-slate-400 font-semibold font-mono">Committed Policies: {modules.length}</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each modules as mod}
        <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/20 relative group">
          
          <!-- Module header -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-100 border border-slate-200/50 text-slate-700">{mod.code}</span>
              </div>
              
              <!-- Combined Premium Action Switch Badge -->
              <button 
                onclick={() => toggleModule(mod.id)}
                class="group px-3 py-1 rounded-full text-[10px] font-bold tracking-tight border transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-sm
                  {mod.active 
                    ? 'bg-emerald-50/80 border-emerald-200/40 text-emerald-700 hover:bg-rose-50 hover:border-rose-200/40 hover:text-rose-700' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200/40 hover:text-emerald-700'}"
                aria-label="Toggle policy active state"
              >
                {#if mod.active}
                  <span class="relative flex h-1.5 w-1.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 group-hover:bg-rose-400"></span>
                    <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 group-hover:bg-rose-500"></span>
                  </span>
                  <span class="group-hover:hidden">Active</span>
                  <span class="hidden group-hover:inline">Deactivate</span>
                {:else}
                  <span class="h-1.5 w-1.5 rounded-full bg-slate-400 group-hover:bg-emerald-500"></span>
                  <span class="group-hover:hidden">Inactive</span>
                  <span class="hidden group-hover:inline">Activate</span>
                {/if}
              </button>
            </div>
            
            <h4 class="text-xs font-extrabold text-slate-800 group-hover:text-primary transition-colors">{mod.name}</h4>
            <p class="text-[11px] text-slate-400 font-medium leading-normal">{mod.desc}</p>
          </div>

          <!-- Module active metadata -->
          <div class="border-t border-slate-100 pt-3 mt-2 text-[10px] space-y-1.5 text-slate-500">
            <div class="flex justify-between">
              <span>Auditor Deadline:</span>
              <span class="font-mono font-bold text-slate-700">{mod.deadline}</span>
            </div>
            <div class="flex justify-between">
              <span>Target Categories:</span>
              <span class="font-bold text-slate-700">{mod.assignedTo.join(', ')}</span>
            </div>
          </div>

        </div>
      {/each}
    </div>
  </div>

  <!-- Assignments & Audits Logs Tracker -->
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
    <div>
      <h3 class="text-sm font-bold text-slate-800">Committed Group Assignments</h3>
      <p class="text-[10px] text-slate-400 font-medium font-mono">Live telemetry tracker detailing certified organizational governance distributions.</p>
    </div>

    <div class="overflow-x-auto border border-slate-100 rounded-lg">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th class="p-3.5 pl-4 whitespace-nowrap">Policy Module Name</th>
            <th class="p-3.5 whitespace-nowrap">Assigned Target Group</th>
            <th class="p-3.5 whitespace-nowrap">Compliance Deadline</th>
            <th class="p-3.5 pr-4 whitespace-nowrap">Log Status</th>
          </tr>
        </thead>
        <tbody class="font-medium text-slate-600 divide-y divide-slate-100">
          {#each assignmentsLog as log}
            <tr class="hover:bg-slate-50/50 transition-colors">
              <td class="p-3.5 pl-4 font-bold text-slate-800 whitespace-nowrap">{log.module}</td>
              <td class="p-3.5 whitespace-nowrap">
                <span class="px-2 py-0.5 text-[9px] font-bold bg-slate-100 border border-slate-200/40 text-slate-600 rounded">{log.target}</span>
              </td>
              <td class="p-3.5 text-slate-500 font-semibold whitespace-nowrap">{log.deadline}</td>
              <td class="p-3.5 pr-4 whitespace-nowrap">
                <span class="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Active</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Assign Module Modal Overlay -->
  {#if isAssignModalOpen}
    <div 
      transition:fade={{duration: 150}} 
      class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onclick={() => isAssignModalOpen = false}
    >
      <div 
        transition:slide={{axis: 'y'}}
        class="bg-white rounded-xl border border-slate-200/60 shadow-2xl w-full max-w-md p-6 space-y-6"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="text-sm font-bold text-slate-800">Assign Policy Module</h3>
          <button 
            onclick={() => isAssignModalOpen = false}
            class="text-slate-400 hover:text-slate-600 font-semibold"
          >
            ✕
          </button>
        </div>

        <form onsubmit={handleCreateAssignment} class="space-y-4">
          
          <!-- Select Policy Module -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="moduleSelect">Select Policy Module</label>
            <select 
              id="moduleSelect"
              bind:value={selectedModuleId}
              class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
            >
              {#each modules as m}
                <option value={m.id}>{m.name} ({m.code})</option>
              {/each}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- Target employee category -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="targetGroupSelect">Target Employee Category</label>
              <select 
                id="targetGroupSelect"
                bind:value={targetGroup}
                class="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
              >
                <option value="All">All Employees</option>
                <option value="General">General Category</option>
                <option value="Manager">Manager Group</option>
                <option value="Executive">Executive Circle</option>
              </select>
            </div>

            <!-- Deadline Date selection -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="deadlineSelect">Compliance Deadline</label>
              <input 
                id="deadlineSelect"
                type="date" 
                bind:value={customDeadline}
                required
                class="w-full border border-slate-200 rounded-lg px-2.5 py-1.2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
              />
            </div>
          </div>

          <div class="flex gap-3 border-t border-slate-100 pt-4">
            <button 
              type="button" 
              onclick={() => isAssignModalOpen = false}
              class="flex-1 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-500 rounded-lg transition-all active:scale-95"
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="flex-1 py-2 bg-primary hover:opacity-95 text-xs font-bold text-white rounded-lg shadow-md shadow-primary/10 transition-all active:scale-95"
            >
              Commit Assignment
            </button>
          </div>

        </form>
      </div>
    </div>
  {/if}

</div>
