<script lang="ts">
  import { slide, fade } from 'svelte/transition';

  // Selected tab state
  let activeTab = $state<"profile" | "rules">("profile");
  let toastMessage = $state<string | null>(null);

  // General Profile state
  let companyName = $state("Acme Corp Financial");
  let industryType = $state("Banking & Finance");
  let websiteUrl = $state("https://acme.corp");
  let logoUrl = $state<string | null>(null);
  let isDragging = $state(false);

  // Exam Rules state
  let passingScore = $state(80); // Default 80% passing threshold
  let cooldownDays = $state(3);  // 3 days cooldown before retaking failed exams
  let autoRemindToggle = $state(true);

  function showToast(message: string) {
    toastMessage = message;
    setTimeout(() => { toastMessage = null; }, 4000);
  }

  // Handle Logo Upload simulation
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      logoUrl = URL.createObjectURL(file);
      showToast("✅ Logo asset uploaded successfully and staged!");
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      logoUrl = URL.createObjectURL(target.files[0]);
      showToast("✅ Logo asset uploaded successfully and staged!");
    }
  }

  // Save Settings Sandbox
  function saveAllSettings() {
    showToast("✅ Company settings successfully saved to Supabase database context!");
  }
</script>

<svelte:head>
  <title>Company Settings - Client Admin | CompliancePro</title>
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
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">System Settings</h1>
      <p class="premium-heading-subtitle">Manage company metadata and configure compliance testing passing thresholds.</p>
    </div>
    
    <button 
      onclick={saveAllSettings}
      class="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-primary text-white rounded-lg shadow-md shadow-primary/10 transition-all hover:opacity-95 active:scale-95 shrink-0"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
      Save System Settings
    </button>
  </div>

  <!-- Tab Menu Navigation -->
  <div class="flex gap-2 border-b border-border pb-px text-xs font-bold">
    <button 
      onclick={() => activeTab = "profile"}
      class="px-4 py-2 border-b-2 transition-all duration-200 outline-none
        {activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground/90'}"
    >
      Company Profile
    </button>
    <button 
      onclick={() => activeTab = "rules"}
      class="px-4 py-2 border-b-2 transition-all duration-200 outline-none
        {activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground/90'}"
    >
      Exam Policy Rules
    </button>
  </div>

  <!-- TAB 1: Company Profile -->
  {#if activeTab === "profile"}
    <div transition:fade={{duration: 100}} class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- General Form Card -->
      <div class="bg-surface rounded-xl border border-border p-6 shadow-sm lg:col-span-2 space-y-4">
        <div>
          <h3 class="text-xs font-extrabold text-foreground uppercase tracking-wider">Organizational Details</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Verify primary identity parameters used for white-labeling templates.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="compName">Company Name *</label>
            <input 
              id="compName"
              type="text" 
              bind:value={companyName}
              required
              class="w-full border border-border rounded-lg px-3 py-2 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
            />
          </div>

          <!-- Industry -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="compIndustry">Industry *</label>
            <select 
              id="compIndustry"
              bind:value={industryType}
              class="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm cursor-pointer"
            >
              <option value="Banking & Finance">Banking & Finance</option>
              <option value="Healthcare & Pharma">Healthcare & Pharma</option>
              <option value="Technology & SaaS">Technology & SaaS</option>
              <option value="Retail & Logistics">Retail & Logistics</option>
              <option value="Legal & Compliance">Legal & Compliance</option>
            </select>
          </div>

          <!-- Website -->
          <div class="space-y-1.5 sm:col-span-2">
            <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="compWebsite">Corporate Website URL</label>
            <input 
              id="compWebsite"
              type="url" 
              bind:value={websiteUrl}
              class="w-full border border-border rounded-lg px-3 py-2 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
            />
          </div>
        </div>
      </div>

      <!-- Company Logo Uploader Card -->
      <div class="bg-surface rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <h3 class="text-xs font-extrabold text-foreground uppercase tracking-wider">Company Logo Brand</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Replaces platform placeholder graphics in header navigation headers.</p>
        </div>

        <!-- Drag zone -->
        <div 
          class="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 relative min-h-[160px]
            {isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/50 hover:bg-muted'}"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          onclick={() => document.getElementById('logoSelectInput')?.click()}
        >
          <input 
            type="file" 
            id="logoSelectInput" 
            accept="image/*" 
            class="hidden" 
            onchange={handleFileSelect} 
          />

          {#if logoUrl}
            <div class="space-y-3">
              <div class="w-16 h-16 rounded bg-surface shadow-sm border border-border/50 flex items-center justify-center p-1.5 mx-auto overflow-hidden">
                <img src={logoUrl} alt="Company logo staged" class="max-w-full max-h-full object-contain" />
              </div>
              <span class="text-[10px] font-bold text-primary">Change Company Logo</span>
            </div>
          {:else}
            <div class="space-y-2">
              <div class="w-8 h-8 rounded-full bg-border/60 border border-border/40 flex items-center justify-center mx-auto text-muted-foreground">
                📁
              </div>
              <div class="text-[10px] font-semibold text-muted-foreground">
                Drag logo here, or <span class="text-primary font-bold">browse files</span>
              </div>
              <div class="text-[8px] text-muted-foreground font-bold uppercase">PNG, JPG up to 2MB</div>
            </div>
          {/if}
        </div>
      </div>

    </div>
  {/if}

  <!-- TAB 2: Exam Policy Rules -->
  {#if activeTab === "rules"}
    <div transition:fade={{duration: 100}} class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      <!-- Passing parameters card -->
      <div class="bg-surface rounded-xl border border-border p-6 shadow-sm space-y-6">
        <div>
          <h3 class="text-xs font-extrabold text-foreground uppercase tracking-wider">Exam Grading Rules</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Adjust required scoring parameters for certifications.</p>
        </div>

        <!-- Slider Passing threshold -->
        <div class="space-y-2">
          <div class="flex justify-between items-center text-xs font-bold text-foreground/90">
            <label for="scoreSlider">Minimum Passing Score Threshold</label>
            <span class="text-primary font-extrabold text-sm bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{passingScore}% Correct</span>
          </div>
          <input 
            type="range" 
            id="scoreSlider"
            min="60" 
            max="100" 
            step="5" 
            bind:value={passingScore}
            class="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary border border-border"
          />
          <div class="flex justify-between text-[9px] text-muted-foreground font-bold uppercase">
            <span>60% (Lenient)</span>
            <span>80% (Recommended)</span>
            <span>100% (Absolute Mastery)</span>
          </div>
        </div>

        <!-- Cooldown inputs -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" for="cooldown">Re-attempt Cooldown Days</label>
          <input 
            type="number" 
            id="cooldown"
            min="0" 
            max="30" 
            bind:value={cooldownDays}
            class="w-full border border-border rounded-lg px-3 py-2 text-xs bg-muted text-foreground/90 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
          />
          <span class="text-[9px] text-muted-foreground font-medium block">Number of days employees must wait before retaking a failed compliance module exam.</span>
        </div>
      </div>

      <!-- Automation preferences -->
      <div class="bg-surface rounded-xl border border-border p-6 shadow-sm space-y-4 flex flex-col justify-between">
        <div>
          <h3 class="text-xs font-extrabold text-foreground uppercase tracking-wider">Automations & Notifications</h3>
          <p class="text-[10px] text-muted-foreground font-medium">Manage corporate reminder automated triggers.</p>
        </div>

        <div class="space-y-4">
          <div class="flex items-start justify-between gap-4 p-3 bg-muted border border-border rounded-lg">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-foreground">Auto Warning Triggers</span>
              <p class="text-[9px] text-muted-foreground leading-normal">Automatically warning employees on upcoming compliance schedules.</p>
            </div>
            <button 
              onclick={() => autoRemindToggle = !autoRemindToggle}
              class="w-10 h-5 rounded-full p-0.5 transition-colors relative border duration-200 shrink-0 mt-0.5
                {autoRemindToggle ? 'bg-primary border-primary/25' : 'bg-border border-border'}"
              aria-label="Toggle auto reminder triggers"
            >
              <div class="w-3.8 h-3.8 rounded-full bg-surface shadow-sm transition-transform duration-200 transform {autoRemindToggle ? 'translate-x-5' : 'translate-x-0'}"></div>
            </button>
          </div>

          <div class="flex items-start justify-between gap-4 p-3 bg-muted border border-border rounded-lg">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-foreground">Escalate Failure alerts</span>
              <p class="text-[9px] text-muted-foreground leading-normal">Automatically notify HR managers when an employee fails a module exam twice.</p>
            </div>
            <span class="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-success/10 text-success border border-success/20 mt-1">Enabled</span>
          </div>
        </div>

      </div>

    </div>
  {/if}

</div>
