<script lang="ts">
  import { fade } from 'svelte/transition';
</script>

<div 
  out:fade={{ duration: 150 }}
  in:fade={{ duration: 150 }}
  class="space-y-8 w-full animate-fade-in"
>
  <!-- Header Skeleton -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
    <div class="flex items-center gap-3">
      <!-- Glow indicator mockup -->
      <div class="w-1 h-8 rounded bg-primary/40 animate-pulse"></div>
      <div class="space-y-2">
        <div class="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="h-3 w-80 bg-slate-100 dark:bg-slate-850 rounded animate-pulse"></div>
      </div>
    </div>
    <div class="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse shrink-0"></div>
  </div>

  <!-- Cards Grid Skeleton -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
    {#each Array(4) as _}
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div class="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="h-2 w-full bg-slate-100 dark:bg-slate-850 rounded animate-pulse"></div>
      </div>
    {/each}
  </div>

  <!-- Big Content Layout Grid Skeleton -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Main Area -->
    <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-5">
      <div class="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-850">
        <div class="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
      </div>
      <div class="space-y-4">
        {#each Array(4) as _}
          <div class="flex items-center justify-between py-2.5">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-slate-150 dark:bg-slate-800 animate-pulse"></div>
              <div class="space-y-1.5">
                <div class="h-3.5 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div class="h-2.5 w-24 bg-slate-100 dark:bg-slate-850 rounded animate-pulse"></div>
              </div>
            </div>
            <div class="h-3 w-12 bg-slate-150 dark:bg-slate-800 rounded animate-pulse"></div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Sidebar Area -->
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6">
      <div class="space-y-2">
        <div class="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="h-3 w-full bg-slate-100 dark:bg-slate-850 rounded animate-pulse"></div>
      </div>
      <div class="space-y-3">
        {#each Array(3) as _}
          <div class="h-10 w-full bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-lg animate-pulse"></div>
        {/each}
      </div>
    </div>
  </div>
</div>
