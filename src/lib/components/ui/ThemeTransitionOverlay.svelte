<script lang="ts">
  import { themeTransition } from '$lib/stores/themeTransition';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut, expoOut } from 'svelte/easing';

  let visible = $state(false);
  let targetMode = $state<'dark' | 'light'>('light');

  themeTransition.subscribe(state => {
    visible = state.active;
    targetMode = state.targetMode;
  });

  let isDark = $derived(targetMode === 'dark');
</script>

{#if visible}
  <!-- Full-screen solid backdrop -->
  <div
    class="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden transition-colors duration-500
           {isDark ? 'bg-slate-950' : 'bg-slate-50'}"
    in:fade={{ duration: 250, easing: cubicOut }}
    out:fade={{ duration: 400, easing: cubicOut }}
  >
    <!-- Huge ambient glow behind the card -->
    <div 
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] opacity-40 pointer-events-none transition-colors duration-700"
      class:bg-blue-500={isDark}
      class:bg-amber-300={!isDark}
    ></div>

    <!-- Center Solid Card -->
    <div 
      class="relative z-10 flex flex-col items-center gap-7 px-14 py-10 rounded-[2rem] border shadow-2xl transition-all duration-500
             {isDark ? 'bg-slate-900 border-slate-800 shadow-black/60' : 'bg-white border-slate-200/60 shadow-slate-300/60'}"
      in:scale={{ start: 0.96, duration: 450, easing: expoOut }}
    >
      <!-- Visual Loader Center -->
      <div class="relative flex items-center justify-center w-[120px] h-[120px]">
        
        <!-- Flawless SVG Ring Progress (Guaranteed mathematical centering) -->
        <svg class="absolute inset-0 w-full h-full -rotate-90 drop-shadow-sm pointer-events-none" viewBox="0 0 120 120">
          <!-- Background Track -->
          <circle 
            cx="60" cy="60" r="56" 
            class="fill-none transition-colors duration-500 {isDark ? 'stroke-slate-800' : 'stroke-slate-200'}" 
            stroke-width="3"
          />
          <!-- Animated Foreground Sweep -->
          <circle 
            cx="60" cy="60" r="56" 
            class="fill-none transition-colors duration-500 animate-premium-dash {isDark ? 'stroke-blue-500' : 'stroke-amber-400'}" 
            stroke-width="3.5"
            stroke-linecap="round"
          />
        </svg>

        <!-- Inner Floating Bubble for Icon -->
        <div 
          class="relative flex items-center justify-center w-[92px] h-[92px] rounded-full transition-colors duration-500 z-10 shadow-lg
                 {isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100'}"
        >
          <!-- Subtle inner glow to give the bubble a 3D feel -->
          <div class="absolute inset-0 rounded-full opacity-60 pointer-events-none transition-colors duration-500 {isDark ? 'bg-gradient-to-tr from-blue-500/20 to-transparent' : 'bg-gradient-to-tr from-amber-400/20 to-transparent'}"></div>

          {#if isDark}
            <svg class="relative z-10 w-[38px] h-[38px] text-blue-400 drop-shadow animate-icon-pop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          {:else}
            <svg class="relative z-10 w-[38px] h-[38px] text-amber-500 drop-shadow animate-spin-slow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          {/if}
        </div>
      </div>

      <!-- Typography -->
      <div class="flex flex-col items-center gap-2 text-center mt-2">
        <h2 class="text-[1.15rem] font-bold tracking-tight transition-colors duration-500 {isDark ? 'text-slate-50' : 'text-slate-800'}">
          {isDark ? 'Switching to Dark Mode' : 'Switching to Light Mode'}
        </h2>
        <p class="text-[0.92rem] font-medium transition-colors duration-500 {isDark ? 'text-blue-400/80' : 'text-amber-500/90'} animate-pulse-soft">
          Applying preferences...
        </p>
      </div>

    </div>
  </div>
{/if}

<style>
  /* SVG Circular Loader Animation */
  .animate-premium-dash {
    stroke-dasharray: 352; /* 2 * pi * 56 ≈ 351.85 */
    stroke-dashoffset: 352;
    animation: dash-fill 1.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  }

  @keyframes dash-fill {
    0% { stroke-dashoffset: 352; transform: rotate(0deg); transform-origin: center; }
    100% { stroke-dashoffset: 0; transform: rotate(360deg); transform-origin: center; }
  }

  /* Crisp entry for the moon */
  .animate-icon-pop {
    animation: pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes pop-in {
    0% { opacity: 0; transform: scale(0.5) rotate(-30deg); filter: drop-shadow(0 0 0 transparent); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); filter: drop-shadow(0 4px 6px rgba(96, 165, 250, 0.4)); }
  }

  /* Smooth spin entry for the sun */
  .animate-spin-slow {
    animation: spin-in 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  }

  @keyframes spin-in {
    0% { opacity: 0; transform: scale(0.5) rotate(-120deg); filter: drop-shadow(0 0 0 transparent); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); filter: drop-shadow(0 4px 6px rgba(245, 158, 11, 0.4)); }
  }

  /* Breathing opacity for the subtitle */
  .animate-pulse-soft {
    animation: pulse-soft 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-soft {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>