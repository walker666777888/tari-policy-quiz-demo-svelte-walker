<script lang="ts">
  import { fade, fly, slide } from 'svelte/transition';

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

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative px-1 sm:px-4">

  <!-- Welcome Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground transition-all duration-300">
        Welcome back, {employee.firstName}! 👋
      </h1>
      <p class="premium-heading-subtitle text-sm text-muted-foreground font-medium mt-1.5">
        Track your corporate compliance score, review milestones, and complete active training requirements.
      </p>
    </div>
  </div>

  <!-- 4 Premium Stat Cards with Staggered Entrance Animations -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- 1. Personal Compliance Score -->
    <div 
      in:fly={{ y: 15, duration: 450, delay: 0 }}
      class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[11.5rem] sm:min-h-[12.5rem] relative overflow-hidden group"
    >
      <div>
        <span class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1.5 block">Compliance Score</span>
        <div class="text-4xl font-black text-foreground tracking-tight mt-2 group-hover:scale-[1.02] transition-transform duration-300">{employee.overallScore}%</div>
      </div>
      <div class="w-full space-y-3.5 mt-auto pt-4">
        <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
          <div class="h-full bg-primary rounded-full transition-all duration-1000 relative" style="width: {employee.overallScore}%">
            <!-- Shimmer sweep effect on loading progress -->
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] w-[40%]"></div>
          </div>
        </div>
        <div class="text-xs text-muted-foreground/80 font-medium max-w-[85%] leading-relaxed">Excellent standing! Keep it up.</div>
      </div>
      <div class="absolute right-4 bottom-4 text-primary/10 group-hover:text-primary/20 group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>
      </div>
    </div>

    <!-- 2. Assigned vs Completed -->
    <div 
      in:fly={{ y: 15, duration: 450, delay: 80 }}
      class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-355 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[11.5rem] sm:min-h-[12.5rem] relative overflow-hidden group"
    >
      <div>
        <span class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1.5 block">Completed Quizzes</span>
        <div class="text-4xl font-black text-foreground tracking-tight mt-2 group-hover:scale-[1.02] transition-transform duration-300">
          {employee.completedTotal}<span class="text-muted-foreground text-xl font-medium">/{employee.assignedTotal}</span>
        </div>
      </div>
      <div class="text-xs font-semibold text-muted-foreground/90 mt-auto pt-4 flex items-start gap-1.5 z-10 max-w-[85%] leading-relaxed">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-[3px] shrink-0"></span>
        Fully certified policies
      </div>
      <div class="absolute right-4 bottom-4 text-emerald-500/10 group-hover:text-emerald-500/20 group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
    </div>

    <!-- 3. Pending / Overdue -->
    <div 
      in:fly={{ y: 15, duration: 450, delay: 160 }}
      class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-360 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[11.5rem] sm:min-h-[12.5rem] relative overflow-hidden group"
    >
      <div>
        <span class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1.5 block">Pending Quizzes</span>
        <div class="flex items-center gap-3 mt-2">
          <div class="text-4xl font-black text-foreground tracking-tight group-hover:scale-[1.02] transition-transform duration-300">{employee.assignedTotal - employee.completedTotal}</div>
          {#if employee.overdueTotal > 0}
            <span class="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse z-10">{employee.overdueTotal} Overdue</span>
          {/if}
        </div>
      </div>
      <div class="text-xs font-semibold text-muted-foreground/90 mt-auto pt-4 flex items-start gap-1.5 z-10 max-w-[85%] leading-relaxed">
        <span class="w-2.5 h-2.5 rounded-full {employee.overdueTotal > 0 ? 'bg-rose-500' : 'bg-amber-400'} mt-[3px] shrink-0"></span>
        Review soon to stay compliant
      </div>
      <div class="absolute right-4 bottom-4 {employee.overdueTotal > 0 ? 'text-rose-500/10 group-hover:text-rose-500/20' : 'text-amber-500/10 group-hover:text-amber-500/20'} group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      </div>
    </div>

    <!-- 4. Next Due Highlight -->
    <div 
      in:fly={{ y: 15, duration: 450, delay: 240 }}
      class="bg-primary rounded-2xl border border-primary p-5 sm:p-6 shadow-md shadow-primary/20 flex flex-col justify-between min-h-[11.5rem] sm:min-h-[12.5rem] relative overflow-hidden group text-white hover:shadow-lg hover:shadow-primary/30 transition-all duration-350"
    >
      <div class="z-10">
        <span class="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-1.5 block">Next Quiz Due</span>
        {#if nextDue}
          <div class="text-lg sm:text-xl font-extrabold tracking-tight mt-2 group-hover:scale-[1.01] transition-transform duration-300 leading-tight line-clamp-2">{nextDue.title}</div>
        {:else}
          <div class="text-lg sm:text-xl font-extrabold tracking-tight mt-2 group-hover:scale-[1.01] transition-transform duration-300 leading-tight">All Caught Up! 🎉</div>
        {/if}
      </div>
      {#if nextDue}
        <div class="flex items-center justify-between mt-auto pt-4 z-10 w-full gap-2">
          <span class="text-[11px] font-bold {nextDue.urgency === 'red' ? 'text-rose-200 animate-pulse' : 'text-white/90'} uppercase tracking-wider leading-relaxed">Due {formatDate(nextDue.dueDate)}</span>
          <a href="/dashboard/assessment/{nextDue.id}" class="text-[11px] font-extrabold bg-white text-primary px-3.5 py-1.5 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-transform duration-200 shrink-0">Start Now</a>
        </div>
      {/if}
      <div class="absolute right-4 bottom-4 text-white/10 group-hover:text-white/20 group-hover:scale-110 transition-all duration-300 pointer-events-none">
        <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
      </div>
    </div>

  </div>

  <!-- Filters & Section Title -->
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-12 pt-6 border-t border-border/60">
    <div class="premium-heading-group">
      <h2 class="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">
        My Compliance Modules
      </h2>
      <p class="text-xs text-muted-foreground font-medium mt-1 max-w-xl leading-relaxed">
        Access your active training curriculum, review past grades, and complete ongoing policy exams.
      </p>
    </div>
    
    <!-- Filter Toggle Segment with Hover Animations -->
    <div class="flex bg-muted border border-border p-1 rounded-xl shadow-inner relative overflow-hidden self-start sm:self-auto">
      {#each ["All", "Pending", "Completed", "Overdue"] as filterOption}
        <button 
          onclick={() => activeFilter = filterOption}
          class="px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 relative z-10 active:scale-95 cursor-pointer
            {activeFilter === filterOption ? 'bg-surface text-foreground shadow-sm border border-border/80' : 'text-muted-foreground hover:text-foreground'}"
        >
          {filterOption}
        </button>
      {/each}
    </div>
  </div>

  <!-- Modules Grid with Keyed Entrance Animations -->
  {#key activeFilter}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each filteredModules as mod, i (mod.id)}
        <div 
          in:fly={{ y: 15, duration: 400, delay: i * 60 }}
          class="bg-surface rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between space-y-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:border-primary/25 hover:ring-4 hover:ring-primary/5 group"
        >
          
          <!-- Top header -->
          <div class="space-y-3.5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-muted border border-border text-muted-foreground/80 mb-2 inline-block tracking-widest">Module</span>
                <h4 class="text-base font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug truncate" title={mod.title}>{mod.title}</h4>
              </div>
              
              <!-- Status Badge with Hover Scale -->
              <div class="shrink-0 group-hover:scale-105 transition-transform duration-300">
                {#if mod.status === 'Completed'}
                  <span class="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20" title="Completed">
                    <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                  </span>
                {:else if mod.status === 'In Progress'}
                  <span class="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20" title="In Progress">
                    <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </span>
                {:else}
                  <span class="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center border border-border" title="Not Started">
                    <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                  </span>
                {/if}
              </div>
            </div>
            
            <!-- Due Date & Urgency with soft glowing animations -->
            <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
              {#if mod.urgency === 'red' && mod.status !== 'Completed'}
                <span class="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">Overdue: {formatDate(mod.dueDate)}</span>
              {:else if mod.urgency === 'yellow' && mod.status !== 'Completed'}
                <span class="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">Due Soon: {formatDate(mod.dueDate)}</span>
              {:else}
                <span class="px-2 py-0.5 rounded-lg bg-muted border border-border text-muted-foreground">Deadline: {formatDate(mod.dueDate)}</span>
              {/if}
            </div>
          </div>

          <!-- Middle stats with sleek dividers -->
          <div class="grid grid-cols-2 gap-4 py-4 border-y border-border">
            <div class="space-y-1">
              <div class="text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-widest mb-0.5">Progress</div>
              <div class="text-sm font-extrabold text-foreground">{mod.questionsAttempted} / {mod.totalQuestions}</div>
              <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-500 ease-out" style="width: {(mod.questionsAttempted / mod.totalQuestions) * 100}%"></div>
              </div>
            </div>
            <div>
              <div class="text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-widest mb-0.5">Best Score</div>
              <div class="text-sm font-black mt-0.5 {mod.bestScore ? 'text-primary' : 'text-muted-foreground'}">
                {mod.bestScore ? `${mod.bestScore}%` : '—'}
              </div>
            </div>
          </div>

          <!-- Interactive Action Buttons -->
          <div class="pt-1">
            {#if mod.status === 'Completed'}
              <a href="/dashboard/assessment/{mod.id}" class="block w-full py-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-bold text-center rounded-xl border border-border transition-all active:scale-[0.98]">
                Review / Retake Exam
              </a>
            {:else if mod.status === 'In Progress'}
              <a href="/dashboard/assessment/{mod.id}" class="block w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold text-center rounded-xl border border-primary/20 transition-all active:scale-[0.98]">
                Continue Exam
              </a>
            {:else}
              <a href="/dashboard/assessment/{mod.id}" class="block w-full py-3 bg-primary hover:opacity-95 text-white text-xs font-bold text-center rounded-xl shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] cursor-pointer">
                Start Exam
              </a>
            {/if}
          </div>

        </div>
      {/each}
    </div>
  {/key}

  {#if filteredModules.length === 0}
    <div in:fade={{duration: 250}} class="text-center py-16 bg-surface rounded-2xl border border-border">
      <div class="text-muted-foreground/40 mb-3">
        <svg class="w-12 h-12 mx-auto animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      </div>
      <h3 class="text-sm font-bold text-foreground">No compliance modules found</h3>
      <p class="text-xs text-muted-foreground mt-1">Try selecting a different filter.</p>
    </div>
  {/if}

</div>