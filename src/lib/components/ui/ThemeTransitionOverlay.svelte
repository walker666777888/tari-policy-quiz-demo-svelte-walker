<script lang="ts">
  import { themeTransition } from '$lib/stores/themeTransition';
  import { fade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';

  let visible = $state(false);
  let targetMode = $state<'dark' | 'light'>('light');

  themeTransition.subscribe(state => {
    visible = state.active;
    targetMode = state.targetMode;
  });

  // Computed values for dark vs light overlay
  let isDark = $derived(targetMode === 'dark');
</script>

{#if visible}
  <!-- Premium Theme Transition Overlay -->
  <div
    class="theme-overlay"
    class:dark-overlay={isDark}
    class:light-overlay={!isDark}
    in:fade={{ duration: 220, easing: cubicInOut }}
    out:fade={{ duration: 380, easing: cubicInOut }}
  >
    <!-- Radial pulse rings -->
    <div class="ring ring-1"></div>
    <div class="ring ring-2"></div>
    <div class="ring ring-3"></div>

    <!-- Central content -->
    <div class="overlay-content">

      <!-- Animated icon -->
      <div class="icon-wrapper">
        {#if isDark}
          <!-- Moon + stars for dark mode -->
          <div class="icon-bg dark-bg">
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon moon-icon">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
            <!-- Star sparkles -->
            <span class="sparkle s1">✦</span>
            <span class="sparkle s2">✧</span>
            <span class="sparkle s3">✦</span>
            <span class="sparkle s4">✧</span>
          </div>
        {:else}
          <!-- Sun for light mode -->
          <div class="icon-bg light-bg">
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon sun-icon">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/><path d="M12 20v2"/>
              <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
              <path d="M2 12h2"/><path d="M20 12h2"/>
              <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
            <!-- Glow rays -->
            <span class="ray r1"></span>
            <span class="ray r2"></span>
            <span class="ray r3"></span>
            <span class="ray r4"></span>
          </div>
        {/if}
      </div>

      <!-- Label -->
      <p class="overlay-label" class:label-dark={isDark} class:label-light={!isDark}>
        {isDark ? 'Switching to Dark Mode' : 'Switching to Light Mode'}
      </p>

      <!-- Progress bar -->
      <div class="progress-track" class:track-dark={isDark} class:track-light={!isDark}>
        <div class="progress-fill" class:fill-dark={isDark} class:fill-light={!isDark}></div>
      </div>

    </div>
  </div>
{/if}

<style>
  /* === Base Overlay === */
  .theme-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .dark-overlay {
    background: radial-gradient(ellipse at 50% 40%, #0f1729 0%, #060c1a 60%, #000308 100%);
  }

  .light-overlay {
    background: radial-gradient(ellipse at 50% 40%, #fffdf7 0%, #f0f4ff 55%, #dde8ff 100%);
  }

  /* === Radial Pulse Rings === */
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid;
    animation: ring-pulse 1.1s cubic-bezier(0.4, 0, 0.6, 1) forwards;
    pointer-events: none;
  }

  .dark-overlay .ring { border-color: rgba(99, 157, 255, 0.25); }
  .light-overlay .ring { border-color: rgba(251, 191, 36, 0.3); }

  .ring-1 { width: 160px; height: 160px; animation-delay: 0ms; }
  .ring-2 { width: 300px; height: 300px; animation-delay: 80ms; }
  .ring-3 { width: 460px; height: 460px; animation-delay: 160ms; }

  @keyframes ring-pulse {
    from { opacity: 0.8; transform: scale(0.4); }
    to   { opacity: 0;   transform: scale(1); }
  }

  /* === Content === */
  .overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    animation: content-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
  }

  @keyframes content-enter {
    from { opacity: 0; transform: translateY(12px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }

  /* === Icon === */
  .icon-wrapper {
    position: relative;
  }

  .icon-bg {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .dark-bg {
    background: radial-gradient(circle, rgba(79, 130, 246, 0.18) 0%, rgba(30, 58, 138, 0.08) 100%);
    border: 1.5px solid rgba(99, 157, 255, 0.3);
    box-shadow: 0 0 40px rgba(99, 157, 255, 0.25), 0 0 80px rgba(79, 130, 246, 0.12);
  }

  .light-bg {
    background: radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, rgba(251, 146, 60, 0.08) 100%);
    border: 1.5px solid rgba(251, 191, 36, 0.4);
    box-shadow: 0 0 40px rgba(251, 191, 36, 0.35), 0 0 80px rgba(251, 191, 36, 0.15);
  }

  .icon {
    display: block;
  }

  .moon-icon {
    color: #93bbff;
    animation: moon-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
  }

  .sun-icon {
    color: #f59e0b;
    animation: sun-spin 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
  }

  @keyframes moon-enter {
    from { opacity: 0; transform: rotate(-40deg) scale(0.6); }
    to   { opacity: 1; transform: rotate(0deg)   scale(1); }
  }

  @keyframes sun-spin {
    from { opacity: 0; transform: rotate(-60deg) scale(0.5); }
    to   { opacity: 1; transform: rotate(0deg)   scale(1); }
  }

  /* === Dark Mode Sparkles === */
  .sparkle {
    position: absolute;
    font-size: 0.8rem;
    animation: sparkle-float 1s ease-out both;
    opacity: 0;
  }

  .s1 { top: -8px;  left: 14px;  color: #c4d9ff; animation-delay: 0.3s; font-size: 0.6rem; }
  .s2 { top: 8px;   right: -10px; color: #93bbff; animation-delay: 0.5s; font-size: 0.9rem; }
  .s3 { bottom: -6px; right: 12px; color: #c4d9ff; animation-delay: 0.4s; font-size: 0.5rem; }
  .s4 { bottom: 10px; left: -10px; color: #93bbff; animation-delay: 0.6s; font-size: 0.7rem; }

  @keyframes sparkle-float {
    0%   { opacity: 0; transform: scale(0) rotate(-20deg); }
    60%  { opacity: 1; transform: scale(1.2) rotate(10deg); }
    100% { opacity: 0.7; transform: scale(1) rotate(0deg); }
  }

  /* === Light Mode Sun Rays === */
  .ray {
    position: absolute;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.45);
    animation: ray-expand 0.9s ease-out 0.25s both;
  }

  .r1, .r3 { width: 2px; height: 28px; left: 50%; transform-origin: bottom center; }
  .r2, .r4 { width: 28px; height: 2px; top: 50%; transform-origin: left center; }
  .r1 { top: -32px; margin-left: -1px; }
  .r3 { bottom: -32px; margin-left: -1px; }
  .r2 { left: -32px; margin-top: -1px; }
  .r4 { right: -32px; margin-top: -1px; }

  @keyframes ray-expand {
    from { opacity: 0; transform: scaleY(0); }
    to   { opacity: 1; transform: scaleY(1); }
  }

  /* === Label === */
  .overlay-label {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    margin: 0;
  }

  .label-dark  { color: #c4d9ff; }
  .label-light { color: #92400e; }

  /* === Progress Bar === */
  .progress-track {
    width: 160px;
    height: 3px;
    border-radius: 999px;
    overflow: hidden;
  }

  .track-dark  { background: rgba(99, 157, 255, 0.15); }
  .track-light { background: rgba(251, 191, 36, 0.2); }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    animation: fill-progress 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
    width: 0%;
  }

  .fill-dark  { background: linear-gradient(90deg, #4f82f6, #93bbff); }
  .fill-light { background: linear-gradient(90deg, #f59e0b, #fde68a); }

  @keyframes fill-progress {
    from { width: 0%; }
    to   { width: 100%; }
  }
</style>
