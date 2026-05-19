<script lang="ts">
  import { fade } from 'svelte/transition';

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

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative pb-10">

  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">My Progress &amp; History</h1>
      <p class="premium-heading-subtitle">Track your compliance scores, review past exams, and earn milestone badges.</p>
    </div>
  </div>

  <!-- Top Metrics -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exams Taken</div>
      <div class="text-3xl font-black text-slate-800">{metrics.totalExamsTaken}</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Questions Seen</div>
      <div class="text-3xl font-black text-primary">{metrics.totalQuestionsSeen}</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Average Score</div>
      <div class="text-3xl font-black text-emerald-500">{metrics.averageScore}%</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Perfect 100%s</div>
      <div class="text-3xl font-black text-amber-500">{metrics.perfectScores}</div>
    </div>
  </div>

  <!-- Performance Chart & Achievements -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Score Improvement Chart -->
    <div class="bg-white rounded-xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
      <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-6">Score Improvement Over Time</h3>
      
      <div class="h-48 flex items-end justify-between gap-2 border-b border-slate-100 pb-2 relative">
        <div class="absolute left-0 right-0 bottom-1/2 border-b border-dashed border-slate-200 z-0"></div>
        <div class="absolute left-0 right-0 top-1/4 border-b border-dashed border-slate-200 z-0 text-[9px] text-slate-400 text-right pr-1">80% Passing</div>
        
        {#each chartData as data}
          <div class="flex flex-col items-center flex-1 z-10 group relative">
            <!-- Tooltip -->
            <div class="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none">
              {data.score}% - {data.module}
            </div>
            <div 
              class="w-full max-w-[40px] rounded-t-sm transition-all duration-500 group-hover:opacity-80 {data.pass ? 'bg-primary' : 'bg-rose-400'}"
              style="height: {data.score}%"
            ></div>
            <div class="text-[8px] font-bold text-slate-400 mt-2 rotate-45 md:rotate-0 truncate w-full text-center">{data.label}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Achievements -->
    <div class="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
      <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4">Milestone Badges</h3>
      <div class="space-y-4">
        {#each achievements as badge}
          <div class="flex items-center gap-4 {badge.earned ? 'opacity-100' : 'opacity-40 grayscale'}">
            <div class="w-12 h-12 rounded-full {badge.earned ? 'bg-amber-100 border border-amber-200 shadow-inner' : 'bg-slate-100 border border-slate-200'} flex items-center justify-center text-2xl shrink-0">
              {badge.icon}
            </div>
            <div>
              <div class="text-xs font-bold text-slate-800">{badge.title}</div>
              <div class="text-[9px] text-slate-500 leading-tight mt-0.5">{badge.desc}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>

  </div>

  <!-- Exam History Table -->
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mt-8">
    <div class="p-6 border-b border-slate-100">
      <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Complete Exam Timeline</h3>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th class="p-4 pl-6 whitespace-nowrap">Certification Module</th>
            <th class="p-4 whitespace-nowrap">Attempt Date</th>
            <th class="p-4 text-center whitespace-nowrap">Final Score</th>
            <th class="p-4 text-center whitespace-nowrap">Questions Seen</th>
            <th class="p-4 pr-6 whitespace-nowrap">Result</th>
          </tr>
        </thead>
        <tbody class="font-medium text-slate-600 divide-y divide-slate-100">
          {#each examHistory as exam}
            <tr class="hover:bg-slate-50/50 transition-colors">
              <td class="p-4 pl-6 font-bold text-slate-800 whitespace-nowrap">{exam.module}</td>
              <td class="p-4 text-slate-500 whitespace-nowrap">{exam.date}</td>
              <td class="p-4 text-center whitespace-nowrap">
                <span class="font-bold {exam.score >= 80 ? 'text-emerald-600' : 'text-rose-600'}">{exam.score}%</span>
              </td>
              <td class="p-4 text-center font-mono whitespace-nowrap">{exam.questions}</td>
              <td class="p-4 pr-6 whitespace-nowrap">
                {#if exam.status === 'Pass'}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 border border-emerald-100 text-emerald-600">Pass</span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-50 border border-rose-100 text-rose-600">Fail</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

</div>
