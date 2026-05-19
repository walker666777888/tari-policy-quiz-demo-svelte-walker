<script lang="ts">
  import { fade } from 'svelte/transition';

  // Simulated authenticated employee data
  const employee = {
    firstName: "John",
    lastName: "Doe",
    overallScore: 87,
    assignedTotal: 5,
    completedTotal: 3,
    overdueTotal: 1,
  };

  // Mock Modules Grid
  let modules = $state([
    { 
      id: "coc", 
      title: "Code of Conduct", 
      status: "Completed", 
      bestScore: 92, 
      dueDate: "2026-06-30",
      urgency: "green", // plenty of time
      questionsAttempted: 10,
      totalQuestions: 10
    },
    { 
      id: "posh", 
      title: "Prevention of Sexual Harassment", 
      status: "In Progress", 
      bestScore: null, 
      dueDate: "2026-05-20",
      urgency: "yellow", // due soon
      questionsAttempted: 4,
      totalQuestions: 10
    },
    { 
      id: "coi", 
      title: "Conflict of Interest", 
      status: "Not Started", 
      bestScore: null, 
      dueDate: "2026-05-15",
      urgency: "red", // overdue
      questionsAttempted: 0,
      totalQuestions: 10
    },
    { 
      id: "pit", 
      title: "Prevention of Insider Trading", 
      status: "Completed", 
      bestScore: 100, 
      dueDate: "2026-08-01",
      urgency: "green",
      questionsAttempted: 10,
      totalQuestions: 10
    },
    { 
      id: "wb", 
      title: "Whistleblower Protocol", 
      status: "Completed", 
      bestScore: 85, 
      dueDate: "2026-05-30",
      urgency: "green",
      questionsAttempted: 10,
      totalQuestions: 10
    }
  ]);

  // Determine "Next Due Module" (the most urgent one that is incomplete)
  const nextDue = modules.filter(m => m.status !== "Completed").sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // Filtering states
  let activeFilter = $state("All");

  let filteredModules = $derived(
    modules.filter(m => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Pending" && m.status !== "Completed") return true;
      if (activeFilter === "Completed" && m.status === "Completed") return true;
      if (activeFilter === "Overdue" && m.urgency === "red" && m.status !== "Completed") return true;
      return false;
    })
  );

  // Helper to format dates
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>My Dashboard - {employee.firstName} | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative">

  <!-- Welcome Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Welcome, {employee.firstName}! 👋</h1>
      <p class="premium-heading-subtitle">Continue your corporate compliance journey and review active certifications.</p>
    </div>
  </div>

  <!-- 4 Premium Stat Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    
    <!-- Personal Compliance Score -->
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Overall Compliance Score</span>
        <div class="text-3xl font-extrabold text-foreground tracking-tight mt-1">{employee.overallScore}%</div>
      </div>
      <div class="w-full space-y-1">
        <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all duration-1000" style="width: {employee.overallScore}%"></div>
        </div>
        <div class="text-[9px] text-muted-foreground font-bold uppercase text-right">Excellent Standing</div>
      </div>
    </div>

    <!-- Assigned vs Completed -->
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">My Modules Progress</span>
        <div class="text-3xl font-extrabold text-foreground tracking-tight mt-1">
          {employee.completedTotal}<span class="text-muted-foreground text-lg font-medium">/{employee.assignedTotal}</span>
        </div>
      </div>
      <div class="text-[11px] text-muted-foreground font-medium">
        Completed Certifications
      </div>
      <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground opacity-20 group-hover:scale-110 transition-transform">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
    </div>

    <!-- Pending / Overdue -->
    <div class="bg-surface rounded-xl border border-border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div>
        <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Modules</span>
        <div class="flex items-center gap-3 mt-1">
          <div class="text-3xl font-extrabold text-foreground tracking-tight">{employee.assignedTotal - employee.completedTotal}</div>
          {#if employee.overdueTotal > 0}
            <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">{employee.overdueTotal} Overdue</span>
          {/if}
        </div>
      </div>
      <div class="text-[11px] text-muted-foreground font-medium">
        Requires attention
      </div>
      <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground opacity-20 group-hover:scale-110 transition-transform">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      </div>
    </div>

    <!-- Next Due Highlight -->
    <div class="bg-primary rounded-xl border border-primary p-5 shadow-md shadow-primary/20 flex flex-col justify-between h-32 relative overflow-hidden group text-white">
      <div>
        <span class="text-[10px] font-bold text-white/70 uppercase tracking-wider">Up Next For You</span>
        {#if nextDue}
          <div class="text-lg font-extrabold tracking-tight mt-1 leading-tight line-clamp-2">{nextDue.title}</div>
        {:else}
          <div class="text-lg font-extrabold tracking-tight mt-1 leading-tight line-clamp-2">All Caught Up! 🎉</div>
        {/if}
      </div>
      {#if nextDue}
        <div class="flex items-center justify-between mt-auto">
          <span class="text-[10px] font-bold {nextDue.urgency === 'red' ? 'text-rose-300 animate-pulse' : 'text-white/80'} uppercase">Due {formatDate(nextDue.dueDate)}</span>
          <a href="/dashboard/assessment/{nextDue.id}" class="text-[10px] font-extrabold bg-white text-primary px-2.5 py-1 rounded shadow hover:scale-105 transition-transform">Go</a>
        </div>
      {/if}
      <div class="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white opacity-5 group-hover:scale-110 transition-transform"></div>
      <div class="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white opacity-10 group-hover:scale-110 transition-transform"></div>
    </div>

  </div>

  <!-- Filters & Section Title -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
    <h3 class="text-base font-extrabold text-foreground tracking-tight">My Compliance Modules</h3>
    
    <div class="flex bg-muted border border-border p-1 rounded-lg">
      {#each ["All", "Pending", "Completed", "Overdue"] as filterOption}
        <button 
          onclick={() => activeFilter = filterOption}
          class="px-3 py-1.5 text-[11px] font-bold rounded-md transition-all {activeFilter === filterOption ? 'bg-surface text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}"
        >
          {filterOption}
        </button>
      {/each}
    </div>
  </div>

  <!-- Modules Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each filteredModules as mod (mod.id)}
      <div class="bg-surface rounded-xl border border-border p-5 shadow-sm flex flex-col justify-between space-y-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/20 group">
        
        <!-- Top header -->
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-muted border border-border text-muted-foreground mb-2 inline-block">Module</span>
              <h4 class="text-sm font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">{mod.title}</h4>
            </div>
            
            <!-- Status Badge -->
            <div class="shrink-0">
              {#if mod.status === 'Completed'}
                <span class="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20" title="Completed">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </span>
              {:else if mod.status === 'In Progress'}
                <span class="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20" title="In Progress">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </span>
              {:else}
                <span class="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center border border-border" title="Not Started">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                </span>
              {/if}
            </div>
          </div>
          
          <!-- Due Date & Urgency -->
          <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase">
            {#if mod.urgency === 'red' && mod.status !== 'Completed'}
              <span class="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">Overdue: {formatDate(mod.dueDate)}</span>
            {:else if mod.urgency === 'yellow' && mod.status !== 'Completed'}
              <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">Due Soon: {formatDate(mod.dueDate)}</span>
            {:else}
              <span class="px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">Deadline: {formatDate(mod.dueDate)}</span>
            {/if}
          </div>
        </div>

        <!-- Middle stats -->
        <div class="grid grid-cols-2 gap-3 py-4 border-y border-border">
          <div>
            <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Progress</div>
            <div class="text-xs font-extrabold text-foreground">{mod.questionsAttempted} / {mod.totalQuestions}</div>
            <div class="h-1 w-full bg-muted rounded-full mt-1.5 overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all" style="width: {(mod.questionsAttempted / mod.totalQuestions) * 100}%"></div>
            </div>
          </div>
          <div>
            <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Best Score</div>
            <div class="text-xs font-extrabold {mod.bestScore ? 'text-primary' : 'text-muted-foreground'}">
              {mod.bestScore ? `${mod.bestScore}%` : '—'}
            </div>
          </div>
        </div>

        <!-- Call to Action Buttons -->
        <div>
          {#if mod.status === 'Completed'}
            <a href="/dashboard/assessment/{mod.id}" class="block w-full py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-bold text-center rounded-lg border border-border transition-all active:scale-95">
              Review / Retake Exam
            </a>
          {:else if mod.status === 'In Progress'}
            <a href="/dashboard/assessment/{mod.id}" class="block w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold text-center rounded-lg border border-primary/20 transition-all active:scale-95">
              Continue Exam
            </a>
          {:else}
            <a href="/dashboard/assessment/{mod.id}" class="block w-full py-2.5 bg-primary hover:opacity-95 text-white text-xs font-bold text-center rounded-lg shadow-md shadow-primary/10 transition-all active:scale-95">
              Start Exam
            </a>
          {/if}
        </div>

      </div>
    {/each}
  </div>

  {#if filteredModules.length === 0}
    <div class="text-center py-12 bg-surface rounded-xl border border-border">
      <div class="text-muted-foreground/50 mb-2">
        <svg class="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      </div>
      <h3 class="text-sm font-bold text-foreground">No modules found</h3>
      <p class="text-xs text-muted-foreground mt-1">Try selecting a different filter.</p>
    </div>
  {/if}

</div>