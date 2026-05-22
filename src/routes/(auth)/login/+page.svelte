<script lang="ts">
  import { goto } from '$app/navigation';
  import { loadTheme } from '$lib/stores/theme';
  import { fade, fly } from 'svelte/transition';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let showPassword = $state(false);
  
  let isBtnActive = $derived(email.trim().length > 0 && password.length > 0 && !loading);

  // Dynamic values carousel index
  let currentSlide = $state(0);
  const slides = [
    { 
      title: "The standard for enterprise compliance.", 
      desc: "Seamlessly provision, track, and manage employee training with an intelligent, fully white-labeled infrastructure." 
    },
    { 
      title: "Audit & certify training in real-time.", 
      desc: "Keep auditor deadlines satisfied automatically with beautiful compliance history logs and secure analytics." 
    },
    { 
      title: "Fully integrated role-based security.", 
      desc: "Establish rigid database scoping, granular dashboard tracking, and seamless single-sign-on (SSO) configurations." 
    }
  ];

  // Mouse positions for the premium dynamic cursor-follow highlight card
  let mouseX = $state(0);
  let mouseY = $state(0);
  let cardElement = $state<HTMLElement | null>(null);

  function handleMouseMove(e: MouseEvent) {
    if (!cardElement) return;
    const rect = cardElement.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  // Rotate marketing value propositions every 4.5 seconds
  $effect(() => {
    const interval = setInterval(() => {
      currentSlide = (currentSlide + 1) % slides.length;
    }, 4800);
    return () => clearInterval(interval);
  });

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    
    loading = true;
    
    // Simulate network delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const emailLower = email.toLowerCase().trim();
    if (emailLower.includes('super')) {
      goto('/super');
    } else if (emailLower.includes('admin') || emailLower.includes('client')) {
      await loadTheme('demo-globex'); 
      goto('/admin');
    } else {
      await loadTheme('demo-acme'); 
      goto('/dashboard');
    }
    
    loading = false;
  }

  function fillCredentials(mockEmail: string) {
    email = mockEmail;
    password = 'password123';
  }
</script>

<style>
  /* Premium moving grid background effect */
  .premium-grid {
    background-size: 30px 30px;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    animation: gridMove 25s linear infinite;
  }
  
  @keyframes gridMove {
    0% { background-position: 0 0; }
    100% { background-position: 30px 30px; }
  }

  /* Micro scale transition for active graphs */
  @keyframes growUp {
    0% { transform: scaleY(0.2); }
    50% { transform: scaleY(1); }
    100% { transform: scaleY(0.2); }
  }
  .animate-grow-fast {
    animation: growUp 1.4s ease-in-out infinite;
    transform-origin: bottom;
  }
  .animate-grow-mid {
    animation: growUp 1.8s ease-in-out infinite 0.2s;
    transform-origin: bottom;
  }
  .animate-grow-slow {
    animation: growUp 2.2s ease-in-out infinite 0.4s;
    transform-origin: bottom;
  }
</style>

<svelte:head>
  <title>Sign In | CompliancePro Enterprise</title>
</svelte:head>

<div class="flex h-screen w-full bg-background font-sans overflow-hidden">
  
  <!-- Left Panel: Premium Branding Hero -->
  <div class="hidden lg:flex lg:w-[45%] relative bg-[#060b16] overflow-hidden items-center justify-center shrink-0 border-r border-slate-900">
    
    <!-- Abstract Glowing Orbs / Premium Mesh Gradient with slow spin animations -->
    <div class="absolute top-[-15%] left-[-15%] w-[650px] h-[650px] bg-primary/25 rounded-full mix-blend-screen filter blur-[120px] opacity-80 animate-[pulse_8s_ease-in-out_infinite]"></div>
    <div class="absolute bottom-[-15%] right-[-15%] w-[550px] h-[550px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[120px] opacity-80 animate-[pulse_10s_ease-in-out_infinite]"></div>
    <div class="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full mix-blend-screen filter blur-[100px] opacity-60"></div>

    <!-- Glowing technical grid background pattern -->
    <div class="absolute inset-0 premium-grid pointer-events-none"></div>

    <!-- Content overlay -->
    <div class="relative z-10 p-16 xl:p-20 max-w-2xl text-white w-full h-full flex flex-col justify-between">
      
      <!-- Logo header -->
      <div class="flex items-center gap-3" in:fade={{duration: 1000}}>
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg shadow-primary/30 border border-white/10">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <span class="text-xl font-bold tracking-tight">CompliancePro<span class="text-primary">.</span></span>
      </div>
      
      <!-- Dynamic Showcase Showcase Card -->
      <div class="w-full space-y-12 my-auto">
        <!-- Key-Triggered Interactive Graphical Card -->
        <div class="relative w-full h-[180px] bg-surface/[0.03] rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md flex items-center justify-center shadow-2xl">
          <div class="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
          {#key currentSlide}
            <div in:fade={{duration: 400}} out:fade={{duration: 200}} class="absolute inset-0 flex items-center justify-center p-6">
              {#if currentSlide === 0}
                <!-- Slide 0 Graphic: Enterprise Compliance Nodes -->
                <div class="relative w-full h-full flex items-center justify-center gap-10">
                  <!-- Glowing center node -->
                  <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.4)] border border-white/10 animate-pulse z-10">
                    <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  </div>
                  <!-- Satellite nodes -->
                  <div class="flex flex-col gap-6 z-10">
                    <div class="w-9 h-9 rounded-xl bg-slate-800/90 border border-white/10 flex items-center justify-center text-muted-foreground shadow-lg animate-[bounce_3.2s_ease-in-out_infinite]">
                      <span class="text-xs">💼</span>
                    </div>
                    <div class="w-9 h-9 rounded-xl bg-slate-800/90 border border-white/10 flex items-center justify-center text-muted-foreground shadow-lg animate-[bounce_3.2s_ease-in-out_infinite_1s]">
                      <span class="text-xs">⚖️</span>
                    </div>
                  </div>
                  <!-- Connecting lines SVG background -->
                  <svg class="absolute inset-0 w-full h-full text-white/[0.04] pointer-events-none" fill="none">
                    <line x1="45%" y1="50%" x2="60%" y2="30%" stroke="currentColor" stroke-dasharray="3 3" stroke-width="2" />
                    <line x1="45%" y1="50%" x2="60%" y2="70%" stroke="currentColor" stroke-dasharray="3 3" stroke-width="2" />
                  </svg>
                </div>
              {:else if currentSlide === 1}
                <!-- Slide 1 Graphic: Real-Time Auditing Dashboard -->
                <div class="w-full h-full flex flex-col justify-center space-y-4 px-6">
                  <div class="flex justify-between items-center bg-slate-900/60 border border-white/10 px-4 py-2 rounded-xl">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span class="text-[10px] font-bold text-slate-200 tracking-wider">Continuous Audit Pipeline</span>
                    </div>
                    <span class="text-[8px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/50">SECURE ACTIVE</span>
                  </div>
                  <!-- Visual equalizer-style audit indicators -->
                  <div class="h-10 w-full flex items-end justify-center gap-3 px-4">
                    <div class="bg-gradient-to-t from-primary to-blue-500 w-6 rounded-t animate-grow-fast" style="height: 40%"></div>
                    <div class="bg-gradient-to-t from-primary to-blue-500 w-6 rounded-t animate-grow-mid" style="height: 85%"></div>
                    <div class="bg-gradient-to-t from-primary to-blue-500 w-6 rounded-t animate-grow-slow" style="height: 60%"></div>
                    <div class="bg-gradient-to-t from-primary to-blue-500 w-6 rounded-t animate-grow-fast" style="height: 95%"></div>
                    <div class="bg-gradient-to-t from-primary to-blue-500 w-6 rounded-t animate-grow-mid" style="height: 50%"></div>
                  </div>
                </div>
              {:else}
                <!-- Slide 2 Graphic: Role-Based Security Scoping Shield -->
                <div class="relative w-full h-full flex items-center justify-center">
                  <!-- Scanning concentric rings -->
                  <div class="absolute w-28 h-28 rounded-full border border-primary/20 animate-[ping_3.5s_infinite]"></div>
                  <div class="absolute w-20 h-20 rounded-full border border-blue-500/10 animate-[ping_4.5s_infinite_1s]"></div>
                  <!-- Middle shield logo -->
                  <div class="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)] border border-white/15 z-10">
                    <svg class="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                  </div>
                </div>
              {/if}
            </div>
          {/key}
        </div>

        <!-- Key-Triggered Rotating Slide Carousel Container -->
        <div class="relative h-[160px] flex items-center">
          {#key currentSlide}
            <div 
              in:fly={{ y: 20, duration: 700 }} 
              out:fade={{ duration: 250 }} 
              class="absolute inset-0 flex flex-col justify-center space-y-4"
            >
              <h1 class="text-[38px] xl:text-[46px] font-extrabold tracking-tight leading-[1.1] text-white">
                {@html slides[currentSlide].title.replace("enterprise compliance", '<span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-primary to-indigo-400">enterprise compliance</span>').replace("real-time", '<span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">real-time</span>').replace("role-based security", '<span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">role-based security</span>')}
              </h1>
              <p class="text-sm xl:text-base text-slate-400 font-medium leading-relaxed max-w-md">
                {slides[currentSlide].desc}
              </p>
            </div>
          {/key}
        </div>
      </div>

      <!-- Stat Counter Segment -->
      <div class="grid grid-cols-2 gap-8 pt-10 border-t border-white/10" in:fade={{duration: 1000, delay: 400}}>
        <div>
          <div class="text-3xl font-black text-white mb-1">99.9%</div>
          <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Uptime SLA</div>
        </div>
        <div>
          <div class="text-3xl font-black text-white mb-1">500+</div>
          <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Enterprise Clients</div>
        </div>
      </div>

    </div>
  </div>

  <!-- Right Panel: Form -->
  <div class="flex-1 grid place-items-center p-8 sm:p-12 lg:p-16 relative overflow-y-auto">
    
    <!-- Ambient, drifting radial glowing orb on top right -->
    <div class="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full filter blur-[80px] -z-10 pointer-events-none"></div>

    <!-- Main Interactive Card with dynamic cursor shadow follower -->
    <div 
      bind:this={cardElement}
      onmousemove={handleMouseMove}
      class="w-full max-w-[430px] space-y-7 relative p-8 sm:p-10 rounded-3xl border border-border bg-surface backdrop-blur-md shadow-2xl overflow-hidden group/card"
      in:fly={{ y: 20, duration: 800, delay: 100 }}
    >
      <!-- Dynamic ambient radial cursor highlight shadow -->
      <div 
        class="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-70"
        style="background: radial-gradient(350px circle at {mouseX}px {mouseY}px, rgba(14, 165, 233, 0.06), transparent 75%);"
      ></div>

      <!-- Mobile Logo Header -->
      <div class="flex lg:hidden items-center gap-3 mb-6">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/30">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <span class="text-lg font-extrabold tracking-tight text-foreground">CompliancePro<span class="text-primary">.</span></span>
      </div>

      <div class="text-left relative z-10">
        <h2 class="text-3xl font-extrabold text-foreground tracking-tight mb-2">Welcome</h2>
        <p class="text-sm text-muted-foreground font-medium">Enter your credentials to securely access your portal.</p>
      </div>

      {#if true}
      <!-- Interactive Demo Auto-fill Selector Badge Box -->
      <div class="p-5 rounded-2xl bg-muted border border-border shadow-sm relative overflow-hidden group hover:border-primary/20 transition-all duration-300 relative z-10">
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl"></div>
        <div class="flex items-center gap-2 mb-3.5 text-foreground font-extrabold text-[10px] uppercase tracking-widest">
          <svg class="w-4 h-4 text-primary animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Interactive Demo Auto-Fill
        </div>
        
        <div class="flex flex-col gap-2">
          <!-- Super Admin -->
          <button 
            type="button" 
            onclick={() => fillCredentials('super@compliancepro.com')} 
            class="flex items-center justify-between w-full bg-surface hover:bg-muted border border-border hover:border-primary/20 p-2.5 rounded-xl transition-all duration-200 group/btn shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-primary/10 text-violet-600 flex items-center justify-center font-extrabold text-[10px] border border-primary/20 group-hover/btn:bg-violet-100 transition-colors shrink-0">SA</div>
              <div class="text-left">
                <div class="text-[11px] font-extrabold text-foreground leading-none">Super Admin</div>
                <div class="text-[9.5px] text-muted-foreground font-mono mt-1">super@compliancepro.com</div>
              </div>
            </div>
            <span class="text-xs text-muted-foreground group-hover/btn:text-primary transition-colors pr-1">→</span>
          </button>

          <!-- Client Admin -->
          <button 
            type="button" 
            onclick={() => fillCredentials('admin@compliancepro.com')} 
            class="flex items-center justify-between w-full bg-surface hover:bg-muted border border-border hover:border-primary/20 p-2.5 rounded-xl transition-all duration-200 group/btn shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center font-extrabold text-[10px] border border-success/20 group-hover/btn:bg-teal-100 transition-colors shrink-0">CA</div>
              <div class="text-left">
                <div class="text-[11px] font-extrabold text-foreground leading-none">Client Admin</div>
                <div class="text-[9.5px] text-muted-foreground font-mono mt-1">admin@compliancepro.com</div>
              </div>
            </div>
            <span class="text-xs text-muted-foreground group-hover/btn:text-primary transition-colors pr-1">→</span>
          </button>

          <!-- Employee -->
          <button 
            type="button" 
            onclick={() => fillCredentials('employee@compliancepro.com')} 
            class="flex items-center justify-between w-full bg-surface hover:bg-muted border border-border hover:border-primary/20 p-2.5 rounded-xl transition-all duration-200 group/btn shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-primary/10 text-indigo-600 flex items-center justify-center font-extrabold text-[10px] border border-primary/20 group-hover/btn:bg-indigo-100 transition-colors shrink-0">JD</div>
              <div class="text-left">
                <div class="text-[11px] font-extrabold text-foreground leading-none">Employee User</div>
                <div class="text-[9.5px] text-muted-foreground font-mono mt-1">john.doe@acme.corp</div>
              </div>
            </div>
            <span class="text-xs text-muted-foreground group-hover/btn:text-primary transition-colors pr-1">→</span>
          </button>
        </div>
      </div>
      {/if}

      <!-- Main Login Form -->
      <form class="space-y-5 relative z-10" onsubmit={handleLogin}>
        <!-- Email Input -->
        <div class="space-y-1.5">
          <label for="email" class="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Email address
          </label>
          <div class="relative">
            <input
              id="email"
              type="email"
              required
              bind:value={email}
              disabled={loading}
              placeholder="name@company.com"
              class="w-full bg-surface border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:border-border/80 disabled:opacity-50"
            />
            <span class="absolute left-4 top-3.5 text-muted-foreground pointer-events-none z-10">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </span>
          </div>
        </div>

        <!-- Password Input -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="password" class="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Password
            </label>
            <a href="#forgot" class="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors">
              Forgot password?
            </a>
          </div>
          <div class="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              bind:value={password}
              disabled={loading}
              placeholder="••••••••"
              class="w-full bg-surface border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-foreground placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all hover:border-border/80 disabled:opacity-50"
            />
            <span class="absolute left-4 top-3.5 text-muted-foreground pointer-events-none z-10">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </span>
            <button
              type="button"
              onclick={() => showPassword = !showPassword}
              class="absolute right-3.5 top-3 text-muted-foreground hover:text-muted-foreground transition-colors cursor-pointer"
              aria-label="Toggle password visibility"
            >
              {#if showPassword}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              {/if}
            </button>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="pt-2">
          <button 
            type="submit" 
            disabled={!isBtnActive} 
            class="w-full rounded-xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 transform group active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed
              {isBtnActive 
                ? 'bg-gradient-to-r from-blue-600 via-primary to-indigo-600 hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5 cursor-pointer' 
                : 'bg-muted text-muted-foreground dark:text-muted-foreground border border-border/50 shadow-none cursor-not-allowed opacity-75'}"
          >
            {#if loading}
              <svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Authenticating...
            {:else}
              Sign in to workspace
              <svg class="w-4 h-4 text-current transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            {/if}
          </button>
        </div>
      </form>
      
      <!-- Footer segment -->
      <p class="text-center text-[11px] text-muted-foreground font-medium pt-6 border-t border-border relative z-10">
        Protected by enterprise-grade encryption. SSO is managed by your IT admin.
      </p>
    </div>
  </div>
</div>