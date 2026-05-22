<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  // Mock Progress Metrics
  const metrics = {
    totalExamsTaken: 12,
    totalQuestionsSeen: 120,
    averageScore: 92,
    perfectScores: 3,
  };

  // Mock Exam History Timeline
  const examHistory = [
    { id: 1, module: "Code of Conduct", date: "May 10, 2026", score: 92, status: "Pass", questions: 10 },
    { id: 2, module: "Prevention of Sexual Harassment", date: "Apr 22, 2026", score: 95, status: "Pass", questions: 10 },
    { id: 3, module: "Conflict of Interest", date: "Apr 15, 2026", score: 100, status: "Pass", questions: 10 },
    { id: 4, module: "Code of Conduct", date: "Jan 10, 2026", score: 75, status: "Fail", questions: 10 },
    { id: 5, module: "Whistleblower Protocol", date: "Dec 05, 2025", score: 100, status: "Pass", questions: 10 },
    { id: 6, module: "Prevention of Insider Trading", date: "Nov 20, 2025", score: 85, status: "Pass", questions: 10 }
  ];

  // Mock Achievements
  const achievements = [
    { title: "First Steps", desc: "Completed your first compliance module", icon: "🌱", earned: true },
    { title: "Perfect Score", desc: "Achieved 100% on any module exam", icon: "🎯", earned: true },
    { title: "Compliance Master", desc: "Passed all 5 core modules", icon: "👑", earned: false },
    { title: "Speed Reader", desc: "Finished an exam in under 2 minutes", icon: "⚡", earned: true },
    { title: "Flawless Streak", desc: "Pass 3 exams in a row without failing", icon: "🔥", earned: true }
  ];

  // Mock Chart Data for "Score Improvement"
  const chartData = examHistory.map((h, i) => ({
    label: `Exam ${examHistory.length - i}`,
    score: h.score,
    pass: h.score >= 80,
    module: h.module
  })).reverse();
</script>

<svelte:head>
  <title>My Progress & History | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative pb-10 px-1 sm:px-4">

  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">My Progress &amp; History</h1>
      <p class="premium-heading-subtitle text-sm text-muted-foreground font-medium mt-1">Track your compliance scores, review past exams, and earn milestone badges.</p>
    </div>
  </div>

  <!-- Top Metrics with Staggered Fade-in -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
    <div in:fly={{ y: 12, duration: 400, delay: 0 }} class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[7.5rem] relative overflow-hidden group text-center">
      <div class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1 block">Exams Taken</div>
      <div class="text-4xl font-black text-foreground tracking-tight mt-1 group-hover:scale-[1.02] transition-transform duration-300">{metrics.totalExamsTaken}</div>
    </div>
    <div in:fly={{ y: 12, duration: 400, delay: 60 }} class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[7.5rem] relative overflow-hidden group text-center">
      <div class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1 block">Questions Seen</div>
      <div class="text-4xl font-black text-primary tracking-tight mt-1 group-hover:scale-[1.02] transition-transform duration-300">{metrics.totalQuestionsSeen}</div>
    </div>
    <div in:fly={{ y: 12, duration: 400, delay: 120 }} class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[7.5rem] relative overflow-hidden group text-center">
      <div class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1 block">Average Score</div>
      <div class="text-4xl font-black text-emerald-600 tracking-tight mt-1 group-hover:scale-[1.02] transition-transform duration-300">{metrics.averageScore}%</div>
    </div>
    <div in:fly={{ y: 12, duration: 400, delay: 180 }} class="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md hover:border-primary/30 flex flex-col justify-between min-h-[7.5rem] relative overflow-hidden group text-center">
      <div class="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1 block">Perfect 100%s</div>
      <div class="text-4xl font-black text-amber-600 tracking-tight mt-1 group-hover:scale-[1.02] transition-transform duration-300">{metrics.perfectScores}</div>
    </div>
  </div>

  <!-- Performance Chart & Achievements -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Score Improvement Chart -->
    <div in:fly={{ y: 15, duration: 500, delay: 240 }} class="bg-surface rounded-2xl border border-border p-6 shadow-sm lg:col-span-2 relative overflow-hidden group">
      <div class="flex items-center gap-2.5 mb-6">
        <span class="w-1.5 h-6 bg-gradient-to-b from-primary to-blue-600 rounded-full"></span>
        <h3 class="text-base sm:text-lg font-extrabold text-foreground tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">Score Improvement Over Time</h3>
      </div>
      
      <div class="h-48 flex items-end justify-between gap-3 border-b border-border pb-2 relative">
        <div class="absolute left-0 right-0 bottom-1/2 border-b border-dashed border-border/80 z-0"></div>
        <div class="absolute left-0 right-0 top-1/4 border-b border-dashed border-border/80 z-0 text-[9px] text-muted-foreground/80 font-bold uppercase tracking-widest text-right pr-1">80% Passing</div>
        
        {#each chartData as data, i}
          <div class="flex flex-col items-center flex-1 z-10 group/bar relative h-full justify-end">
            <!-- Tooltip -->
            <div class="absolute -top-10 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-[#0d1526]/90 backdrop-blur-sm text-white text-[10px] font-bold py-1.5 px-3 rounded-lg border border-white/10 shadow-lg whitespace-nowrap pointer-events-none z-30">
              {data.score}% - {data.module}
            </div>
            
            <!-- Animated bar grow -->
            <div 
              in:fly={{ y: 50, duration: 600, delay: 350 + (i * 50) }}
              class="w-full max-w-[32px] rounded-t-lg transition-all duration-300 group-hover/bar:scale-x-105 hover:opacity-90 relative overflow-hidden
                {data.pass 
                  ? 'bg-gradient-to-t from-primary to-blue-500 shadow-md shadow-primary/10' 
                  : 'bg-gradient-to-t from-rose-500 to-rose-455 shadow-md shadow-rose-500/10'}"
              style="height: {data.score}%"
            >
              <!-- Glass reflect shimmer -->
              <div class="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent w-[50%]"></div>
            </div>
            <div class="text-[8px] font-bold text-muted-foreground dark:text-muted-foreground mt-2 truncate w-full text-center tracking-wider">{data.label}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Achievements -->
    <div in:fly={{ y: 15, duration: 500, delay: 300 }} class="bg-surface rounded-2xl border border-border p-6 shadow-sm">
      <div class="flex items-center gap-2.5 mb-5">
        <span class="w-1.5 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full"></span>
        <h3 class="text-base sm:text-lg font-extrabold text-foreground tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">Milestone Badges</h3>
      </div>
      <div class="space-y-4">
        {#each achievements as badge, i}
          <div 
            in:fly={{ x: 15, duration: 400, delay: 350 + (i * 50) }}
            class="flex items-center gap-4 transition-all duration-300 hover:translate-x-1 {badge.earned ? 'opacity-100' : 'opacity-35 grayscale'}"
          >
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 border transition-all duration-300
              {badge.earned 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:scale-110' 
                : 'bg-muted border-border text-muted-foreground'}"
            >
              {badge.icon}
            </div>
            <div>
              <div class="text-xs font-bold text-foreground leading-tight">{badge.title}</div>
              <div class="text-[11px] font-semibold text-muted-foreground/90 leading-tight mt-1">{badge.desc}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>

  </div>

  <!-- Exam History Table -->
  <div in:fly={{ y: 20, duration: 550, delay: 400 }} class="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mt-8">
    <div class="p-6 border-b border-border">
      <div class="flex items-center gap-2.5">
        <span class="w-1.5 h-6 bg-gradient-to-b from-primary to-emerald-500 rounded-full"></span>
        <h3 class="text-base sm:text-lg font-extrabold text-foreground tracking-tight" style="font-family:'Bricolage Grotesque',sans-serif;">Complete Exam Timeline</h3>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-muted border-b border-border text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80">
            <th class="p-4 pl-6 whitespace-nowrap">Certification Module</th>
            <th class="p-4 whitespace-nowrap">Attempt Date</th>
            <th class="p-4 text-center whitespace-nowrap">Final Score</th>
            <th class="p-4 text-center whitespace-nowrap">Questions Seen</th>
            <th class="p-4 pr-6 whitespace-nowrap">Result</th>
          </tr>
        </thead>
        <tbody class="font-semibold text-muted-foreground/90 divide-y divide-border">
          {#each examHistory as exam, i}
            <tr class="hover:bg-muted/40 transition-colors duration-200">
              <td class="p-4 pl-6 font-extrabold text-foreground whitespace-nowrap">{exam.module}</td>
              <td class="p-4 text-muted-foreground whitespace-nowrap">{exam.date}</td>
              <td class="p-4 text-center whitespace-nowrap">
                <span class="font-black {exam.score >= 80 ? 'text-emerald-600' : 'text-rose-500'}">{exam.score}%</span>
              </td>
              <td class="p-4 text-center font-mono whitespace-nowrap text-xs font-bold">{exam.questions}</td>
              <td class="p-4 pr-6 whitespace-nowrap">
                {#if exam.status === 'Pass'}
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">Pass</span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 border border-rose-500/20 text-rose-500">Fail</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

</div>
