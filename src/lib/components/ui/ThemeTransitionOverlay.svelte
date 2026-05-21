<script lang="ts">
  import { themeTransition } from '$lib/stores/themeTransition';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut, cubicInOut } from 'svelte/easing';

  let visible = $state(false);
  let targetMode = $state<'dark' | 'light'>('light');

  themeTransition.subscribe(state => {
    visible = state.active;
    targetMode = state.targetMode;
  });

  let isDark = $derived(targetMode === 'dark');
</script>

{#if visible}
  <!-- Backdrop -->
  <div
    class="backdrop"
    class:backdrop-dark={isDark}
    class:backdrop-light={!isDark}
    in:fade={{ duration: 180, easing: cubicInOut }}
    out:fade={{ duration: 300, easing: cubicInOut }}
  >
    <!-- Card -->
    <div
      class="card"
      class:card-dark={isDark}
      class:card-light={!isDark}
      in:scale={{ duration: 280, start: 0.88, easing: cubicOut, delay: 60 }}
      out:scale={{ duration: 220, start: 0.94, easing: cubicInOut }}
    >
      <!-- Spinning ring + icon -->
      <div class="ring-container">
        <!-- Animated circular progress ring -->
        <svg class="progress-ring" class:ring-dark={isDark} class:ring-light={!isDark} viewBox="0 0 100 100">
          <defs>
            <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#60a5fa" />
              <stop offset="100%" stop-color="#3b82f6" />
            </linearGradient>
            <linearGradient id="amber-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fcd34d" />
              <stop offset="100%" stop-color="#f59e0b" />
            </linearGradient>
          </defs>
          <!-- Track -->
          <circle class="ring-track" cx="50" cy="50" r="42" />
          <!-- Animated fill -->
          <circle class="ring-fill" cx="50" cy="50" r="42" />
        </svg>

        <!-- Center icon -->
        <div class="icon-circle" class:icon-dark={isDark} class:icon-light={!isDark}>
          {#if isDark}
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="icon moon">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="icon sun">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/><path d="M12 20v2"/>
              <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
              <path d="M2 12h2"/><path d="M20 12h2"/>
              <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          {/if}
        </div>
      </div>

      <!-- Text -->
      <div class="text-block">
        <h3 class="title" class:title-dark={isDark} class:title-light={!isDark}>
          {isDark ? 'Switching to Dark Mode' : 'Switching to Light Mode'}
        </h3>
        <p class="subtitle" class:sub-dark={isDark} class:sub-light={!isDark}>
          Applying preferences...
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ─────────────────────────────────────────────── */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Solid full-screen color — matches the target theme */
  .backdrop-dark  { background: #07101f; }
  .backdrop-light { background: #ede8da; }

  /* ── Card ─────────────────────────────────────────────────── */
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 40px 44px 36px;
    border-radius: 24px;
    min-width: 260px;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.06);
  }

  .card-dark {
    background: radial-gradient(135deg at 30% 20%, #1a2d4e 0%, #0f1c36 45%, #07101f 100%);
    border: 1px solid rgba(99, 157, 255, 0.18);
  }

  .card-light {
    background: radial-gradient(135deg at 30% 20%, #fffef8 0%, #f5f0e8 50%, #ede8da 100%);
    border: 1px solid rgba(217, 170, 80, 0.3);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0,0,0,0.04);
  }

  /* ── Ring Container ───────────────────────────────────────── */
  .ring-container {
    position: relative;
    width: 108px;
    height: 108px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── SVG Progress Ring ────────────────────────────────────── */
  .progress-ring {
    position: absolute;
    inset: 0;
    width: 108px;
    height: 108px;
    transform: rotate(-90deg);
  }

  .ring-track {
    fill: none;
    stroke-width: 5;
  }

  .ring-dark .ring-track  { stroke: rgba(99, 157, 255, 0.12); }
  .ring-light .ring-track { stroke: rgba(217, 170, 80, 0.18); }

  .ring-fill {
    fill: none;
    stroke-width: 5;
    stroke-linecap: round;
    stroke-dasharray: 264;
    stroke-dashoffset: 264;
    animation: spin-fill 0.95s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
  }

  .ring-dark .ring-fill {
    stroke: url(#blue-gradient);
    filter: drop-shadow(0 0 6px rgba(99,157,255,0.7));
  }

  .ring-light .ring-fill {
    stroke: url(#amber-gradient);
    filter: drop-shadow(0 0 6px rgba(217,170,80,0.7));
  }

  @keyframes spin-fill {
    to { stroke-dashoffset: 0; }
  }

  /* ── SVG Gradients (defined inline via <defs>) ────────────── */
  /* We use linearGradient in the SVG HTML above for the stroke  */

  /* ── Center Icon Circle ───────────────────────────────────── */
  .icon-circle {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  .icon-dark {
    background: radial-gradient(circle at 40% 35%, #1e3a6b, #0c1f40);
    border: 1.5px solid rgba(99, 157, 255, 0.3);
    box-shadow: 0 0 24px rgba(99, 157, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.06);
    color: #7eb4ff;
  }

  .icon-light {
    background: radial-gradient(circle at 40% 35%, #fff8e8, #f5e8c0);
    border: 1.5px solid rgba(217, 170, 80, 0.4);
    box-shadow: 0 0 24px rgba(217, 170, 80, 0.35), inset 0 1px 0 rgba(255,255,255,0.5);
    color: #b45309;
  }

  .icon {
    display: block;
    animation: icon-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
  }

  .sun {
    animation: icon-spin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
  }

  @keyframes icon-pop {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes icon-spin {
    from { opacity: 0; transform: rotate(-90deg) scale(0.5); }
    to   { opacity: 1; transform: rotate(0deg) scale(1); }
  }

  /* ── Text ─────────────────────────────────────────────────── */
  .text-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    animation: text-rise 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.25s both;
  }

  @keyframes text-rise {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .title {
    margin: 0;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
    text-align: center;
  }

  .title-dark  { color: #e2eeff; }
  .title-light { color: #3d2a00; }

  .subtitle {
    margin: 0;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    animation: dots 1.2s steps(3, end) 0.4s infinite;
  }

  .sub-dark  { color: rgba(148, 180, 255, 0.6); }
  .sub-light { color: rgba(120, 80, 0, 0.55); }

  @keyframes dots {
    0%   { opacity: 1; }
    33%  { opacity: 0.5; }
    66%  { opacity: 0.8; }
    100% { opacity: 1; }
  }
</style>