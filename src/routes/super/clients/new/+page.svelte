<script lang="ts">
  // Svelte 5 Runes for upgraded interactive onboarding stepper with dynamic branding
  let currentStep = $state(1); // Steps 1, 2, or 3
  let showPassword = $state(false);
  let showSuccessToast = $state(false);

  // Form Field States (Organization Setup)
  let orgName = $state("");
  let orgIndustry = $state("Technology");
  let orgSize = $state("1-50 employees");

  // Dynamic Branding Customization States
  let orgLogo = $state<File | null>(null);
  let orgLogoPreview = $state<string | null>(null);
  let orgColor = $state("#0d9488"); // Default to platform Teal

  // Fallback initial character derived reactively
  let orgInitial = $derived(
    orgName.trim() ? orgName.trim().charAt(0).toUpperCase() : "?"
  );

  // Curated Premium Brand Color Presets
  const colorPresets = [
    { name: "Teal", hex: "#0d9488" },
    { name: "Indigo", hex: "#6366f1" },
    { name: "Emerald", hex: "#10b981" },
    { name: "Ruby Red", hex: "#ef4444" },
    { name: "Amber Orange", hex: "#f59e0b" },
    { name: "Rose Pink", hex: "#ec4899" }
  ];

  // Handle Logo file upload/preview
  function handleLogoChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      orgLogo = file;
      orgLogoPreview = URL.createObjectURL(file);
    }
  }

  // Handle drag and drop logo files
  function handleLogoDrop(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      orgLogo = file;
      orgLogoPreview = URL.createObjectURL(file);
    }
  }

  // Clear logo upload to fallback to Avatar
  function clearLogo() {
    orgLogo = null;
    if (orgLogoPreview) {
      URL.revokeObjectURL(orgLogoPreview);
      orgLogoPreview = null;
    }
  }

  // Form Field States (Primary Admin)
  let adminName = $state("Jane Doe");
  let adminDesignation = $state("");
  let adminEmail = $state("jane.doe@acmecorp.com");
  let tempPassword = $state("p@ssw0rd12345");

  // Generate random temporary passwords
  function regeneratePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < 14; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    tempPassword = password;
  }

  // Handle final form creation click
  function handleCreateClient() {
    if (!orgName.trim() || !adminName.trim() || !adminEmail.trim() || !tempPassword.trim()) {
      alert("Please fill in all mandatory fields before completing.");
      return;
    }

    // Trigger success toast
    showSuccessToast = true;

    // Wait and redirect back to Client directory
    setTimeout(() => {
      showSuccessToast = false;
      window.location.href = "/super/clients";
    }, 3000);
  }
</script>

<svelte:head>
  <title>New Client Onboarding - Super Admin | CompliancePro</title>
</svelte:head>

<!-- Floating Alert Toast Notification -->
{#if showSuccessToast}
  <div class="fixed top-6 right-6 z-50 bg-teal-500 text-white text-xs font-semibold px-5 py-4 rounded-lg shadow-2xl border border-teal-600 flex items-center gap-3 animate-fade-in transition-all">
    <svg class="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    <div>
      <div class="font-bold">Organization Provisioned!</div>
      <p class="text-[10px] text-teal-100 mt-0.5">Redirecting to clientele registry...</p>
    </div>
  </div>
{/if}

<div class="animate-fade-in space-y-6 max-w-2xl mx-auto pb-16">
  
  <!-- Back Link -->
  <a 
    href="/super/clients" 
    class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary transition-all duration-200 hover:-translate-x-1"
  >
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
    Back to Clientele
  </a>

  <!-- Header -->
  <div class="premium-heading-group">
    <h1 class="premium-heading-title">New Client Onboarding</h1>
    <p class="premium-heading-subtitle">Provision a new organization, assign credentials, and set branding assets.</p>
  </div>

  <!-- 3-Step Progress Stepper -->
  <div class="flex items-center justify-between py-3 border-y border-slate-100 bg-slate-50/30 px-4 rounded-xl">
    <!-- Step 1 Indicator -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      onclick={() => orgName.trim() ? currentStep = 1 : null}
      class="flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-105"
    >
      <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors
        {currentStep >= 1 ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-400 border-slate-200'}"
      >
        {#if currentStep > 1}✓{:else}1{/if}
      </span>
      <span class="text-[11px] font-bold transition-colors {currentStep >= 1 ? 'text-slate-900' : 'text-slate-400'}">Organization Setup</span>
    </div>

    <!-- Connector -->
    <div class="flex-1 h-[1px] bg-slate-200 mx-4"></div>

    <!-- Step 2 Indicator -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      onclick={() => (orgName.trim() && adminName.trim()) ? currentStep = 2 : null}
      class="flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-105"
    >
      <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors
        {currentStep >= 2 ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-400 border-slate-200'}"
      >
        {#if currentStep > 2}✓{:else}2{/if}
      </span>
      <span class="text-[11px] font-bold transition-colors {currentStep >= 2 ? 'text-slate-900' : 'text-slate-400'}">Admin Provisioning</span>
    </div>

    <!-- Connector -->
    <div class="flex-1 h-[1px] bg-slate-200 mx-4"></div>

    <!-- Step 3 Indicator -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      onclick={() => (orgName.trim() && adminName.trim() && adminEmail.trim()) ? currentStep = 3 : null}
      class="flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-105"
    >
      <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors
        {currentStep === 3 ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-400 border-slate-200'}"
      >
        3
      </span>
      <span class="text-[11px] font-bold transition-colors {currentStep === 3 ? 'text-slate-900' : 'text-slate-400'}">Review</span>
    </div>
  </div>

  <!-- Stepper Form Panel -->
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-6 sm:p-8 transition-all duration-300 hover:shadow-sm">
    
    <!-- STEP 1: ORGANIZATION SETUP -->
    {#if currentStep === 1}
      <div class="space-y-6 animate-fade-in">
        <div class="border-b border-slate-50 pb-3">
          <h2 class="text-sm font-bold text-slate-800">Organization Setup & Branding</h2>
          <p class="text-[11px] text-slate-500 mt-1">Specify core structural parameters and configure the tenant custom brand theme.</p>
        </div>

        <div class="space-y-5">
          <!-- Org name -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-600" for="orgName">Organization Name <span class="text-red-500">*</span></label>
            <input 
              id="orgName"
              type="text" 
              bind:value={orgName}
              required
              placeholder="e.g. Acme Corp" 
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
            />
          </div>

          <!-- Industry / Size -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-slate-600" for="orgIndustry">Industry Segment</label>
              <select 
                id="orgIndustry"
                bind:value={orgIndustry}
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-white transition-all hover:border-slate-300"
              >
                <option>Technology</option>
                <option>Banking</option>
                <option>Medical</option>
                <option>Supply Chain</option>
                <option>Retail</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-slate-600" for="orgSize">Employee Directory Size</label>
              <select 
                id="orgSize"
                bind:value={orgSize}
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-white transition-all hover:border-slate-300"
              >
                <option>1-50 employees</option>
                <option>51-200 employees</option>
                <option>201-1000 employees</option>
                <option>1000+ employees</option>
              </select>
            </div>
          </div>

          <!-- BRAND ASSETS CUSTOMIZATION -->
          <div class="border-t border-slate-100 pt-5 space-y-5">
            <h3 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>
              Brand Customization (Client & Employee Portal Theme)
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <!-- Left: File Uploader Drag and Drop -->
              <div class="space-y-2">
                <label class="text-xs font-semibold text-slate-600">Company Logo Upload</label>
                
                <!-- drag uploader box -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                  ondragover={(e) => e.preventDefault()}
                  ondrop={handleLogoDrop}
                  class="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center flex flex-col justify-center items-center gap-2 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all min-h-[130px] relative group"
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    class="absolute inset-0 opacity-0 cursor-pointer" 
                    onchange={handleLogoChange}
                  />
                  
                  <svg class="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <div class="text-[11px] font-medium text-slate-600">Drag logo here or <span class="text-primary font-bold">browse</span></div>
                  <p class="text-[9px] text-slate-400 leading-normal">Supports PNG, JPG, or SVG. PNG recommended.</p>
                </div>
              </div>

              <!-- Right: Live Logo Uploader & Fallback Initial Avatar Preview -->
              <div class="space-y-2">
                <label class="text-xs font-semibold text-slate-600">Logo & Avatar Fallback Preview</label>
                
                <div class="border border-slate-100 bg-slate-50/20 rounded-xl p-5 flex items-center justify-center min-h-[130px] transition-all hover:shadow-sm">
                  {#if orgLogoPreview}
                    <div class="flex flex-col items-center gap-2 text-center animate-fade-in">
                      <div class="w-16 h-16 rounded-lg bg-white shadow-sm border border-slate-200/50 flex items-center justify-center p-1.5 overflow-hidden">
                        <img src={orgLogoPreview} alt="Logo preview" class="max-w-full max-h-full object-contain" />
                      </div>
                      <button 
                        type="button" 
                        onclick={clearLogo}
                        class="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded px-2 py-0.5 border border-red-100/50 transition-colors"
                      >
                        Reset Logo
                      </button>
                    </div>
                  {:else}
                    <!-- Fallback Avatar visual mock (initial capital letter in brand circle) -->
                    <div class="flex flex-col items-center gap-2 text-center animate-fade-in">
                      <div 
                        class="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-extrabold shadow-sm border border-black/10 transition-all duration-300 transform hover:scale-105"
                        style="background-color: {orgColor}"
                      >
                        {orgInitial}
                      </div>
                      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Fallback Avatar</div>
                      <p class="text-[9px] text-slate-400 leading-relaxed max-w-[200px]">No logo uploaded. System automatically falls back to branding letters!</p>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Brand Theme Accent Color Picker -->
              <div class="md:col-span-2 space-y-3">
                <label class="text-xs font-semibold text-slate-600">Primary Brand Accent Color</label>
                
                <div class="flex flex-wrap items-center gap-4 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                  <!-- Presets Circular List -->
                  <div class="flex flex-wrap gap-2.5">
                    {#each colorPresets as preset}
                      <button
                        type="button"
                        onclick={() => orgColor = preset.hex}
                        class="w-7 h-7 rounded-full border-2 transition-all duration-200 transform hover:scale-110 flex items-center justify-center shadow-sm"
                        style="background-color: {preset.hex}; border-color: {orgColor === preset.hex ? '#1e293b' : 'transparent'}"
                        title={preset.name}
                      >
                        {#if orgColor === preset.hex}
                          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                        {/if}
                      </button>
                    {/each}
                  </div>

                  <!-- Connector divider -->
                  <div class="h-6 w-[1px] bg-slate-200"></div>

                  <!-- Custom native color picker input -->
                  <div class="flex items-center gap-2">
                    <input 
                      type="color" 
                      bind:value={orgColor}
                      class="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 shadow-sm p-0 bg-transparent"
                    />
                    <div class="text-xs">
                      <span class="text-slate-400 font-semibold">Custom Hex:</span>
                      <span class="font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 ml-1 select-all">{orgColor}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="pt-6 border-t border-slate-100 flex justify-end gap-3">
          <a 
            href="/super/clients"
            class="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Cancel
          </a>
          <button 
            type="button" 
            onclick={() => {
              if (!orgName.trim()) {
                alert("Organization Name is required.");
                return;
              }
              currentStep = 2;
            }}
            class="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95"
          >
            Next: Admin Provisioning
          </button>
        </div>
      </div>

    <!-- STEP 2: ADMIN PROVISIONING -->
    {:else if currentStep === 2}
      <div class="space-y-6 animate-fade-in">
        <div class="border-b border-slate-50 pb-3">
          <h2 class="text-sm font-bold text-slate-800">Primary Administrator</h2>
          <p class="text-[11px] text-slate-500 mt-1">Designate client administrative credentials for this organization node.</p>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-slate-600" for="adminName">Full Name <span class="text-red-500">*</span></label>
              <input 
                id="adminName"
                type="text" 
                bind:value={adminName}
                required
                placeholder="Jane Doe" 
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-slate-600" for="designation">Designation</label>
              <input 
                id="designation"
                type="text" 
                bind:value={adminDesignation}
                placeholder="e.g. Chief Compliance Officer" 
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-600" for="workEmail">Work Email Address <span class="text-red-500">*</span></label>
            <input 
              id="workEmail"
              type="email" 
              bind:value={adminEmail}
              required
              placeholder="jane.doe@acmecorp.com" 
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
            />
          </div>

          <div class="border-t border-slate-50 pt-4 space-y-3">
            <h3 class="text-xs font-bold text-slate-800">Initial Security Credentials</h3>
            
            <div class="space-y-1">
              <label class="text-xs font-semibold text-slate-600" for="tempPassword">Temporary Password <span class="text-red-500">*</span></label>
              <div class="flex gap-3">
                <div class="relative flex-1">
                  <input 
                    id="tempPassword"
                    type={showPassword ? "text" : "password"} 
                    bind:value={tempPassword}
                    required
                    class="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
                  />
                  <!-- Toggle Visibility -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div 
                    onclick={() => showPassword = !showPassword}
                    class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    {#if showPassword}
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    {:else}
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 5.656m0 0l-5.656 5.656m1.42-1.42L20 4M12 9a3 3 0 100 6h.01M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    {/if}
                  </div>
                </div>

                <button 
                  type="button" 
                  onclick={regeneratePassword}
                  class="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19M9 5a9 9 0 0112.492 4.108"></path></svg>
                  Regenerate Password
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-1.5 leading-normal">Admin will be forced to reset upon first login.</p>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="pt-6 border-t border-slate-100 flex justify-end gap-3">
          <button 
            type="button" 
            onclick={() => currentStep = 1}
            class="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Back
          </button>
          <button 
            type="button" 
            onclick={() => {
              if (!adminName.trim() || !adminEmail.trim() || !tempPassword.trim()) {
                alert("Please fill in all mandatory primary administrator fields.");
                return;
              }
              currentStep = 3;
            }}
            class="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95"
          >
            Next: Review Details
          </button>
        </div>
      </div>

    <!-- STEP 3: REVIEW DETAILS -->
    {:else if currentStep === 3}
      <div class="space-y-6 animate-fade-in">
        <div class="border-b border-slate-50 pb-3">
          <h2 class="text-sm font-bold text-slate-800">Review Onboarding Node</h2>
          <p class="text-[11px] text-slate-500 mt-1">Verify all configurations and credential mapping before dispatching the invitation.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <!-- Org card -->
          <div class="border border-slate-100 rounded-xl p-5 space-y-3 bg-slate-50/30 transition-all duration-300 hover:shadow-sm hover:border-slate-200">
            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organization Details</h3>
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-slate-500">Name</span>
                <span class="font-bold text-slate-800 truncate max-w-[150px]">{orgName}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-slate-500">Industry</span>
                <span class="font-bold text-slate-800">{orgIndustry}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-slate-500">Size</span>
                <span class="font-bold text-slate-800">{orgSize}</span>
              </div>
            </div>
          </div>

          <!-- Admin card -->
          <div class="border border-slate-100 rounded-xl p-5 space-y-3 bg-slate-50/30 transition-all duration-300 hover:shadow-sm hover:border-slate-200">
            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Administrator</h3>
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-slate-500">Full Name</span>
                <span class="font-bold text-slate-800">{adminName}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-slate-500">Designation</span>
                <span class="font-bold text-slate-800 truncate max-w-[130px]">{adminDesignation || '—'}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-slate-500">Work Email</span>
                <span class="font-bold text-slate-800 truncate max-w-[150px]">{adminEmail}</span>
              </div>
            </div>
          </div>

          <!-- BRAND CUSTOMIZATION SUMMARY CARD -->
          <div class="border border-slate-100 rounded-xl p-5 bg-slate-50/30 sm:col-span-2 transition-all duration-300 hover:shadow-sm hover:border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div class="space-y-2">
              <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brand Theme Summary</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">Selected Color:</span>
                <span class="w-3.5 h-3.5 rounded-full border border-black/10 shadow-sm" style="background-color: {orgColor}"></span>
                <span class="font-mono text-xs font-bold text-slate-700">{orgColor}</span>
              </div>
            </div>

            <!-- Logo display or dynamic fallback avatar -->
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-500">Active Asset:</span>
              {#if orgLogoPreview}
                <div class="w-12 h-12 rounded-lg bg-white shadow-sm border border-slate-200/50 flex items-center justify-center p-1 overflow-hidden transition-all duration-300 transform hover:scale-105">
                  <img src={orgLogoPreview} alt="Logo thumbnail" class="max-w-full max-h-full object-contain" />
                </div>
              {:else}
                <div 
                  class="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-extrabold shadow-sm border border-black/10 transition-all duration-300 transform hover:scale-105"
                  style="background-color: {orgColor}"
                >
                  {orgInitial}
                </div>
              {/if}
            </div>
          </div>

          <!-- Security parameters summary -->
          <div class="border border-slate-100 rounded-xl p-5 space-y-2 bg-slate-50/30 sm:col-span-2 transition-all duration-300 hover:shadow-sm hover:border-slate-200">
            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Credential Summary</h3>
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-500">Initial Password:</span>
              <span class="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 select-all font-bold text-slate-800">{tempPassword}</span>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="pt-6 border-t border-slate-100 flex justify-end gap-3">
          <button 
            type="button" 
            onclick={() => currentStep = 2}
            class="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Back
          </button>
          
          <button 
            type="button" 
            onclick={handleCreateClient}
            class="px-6 py-2 text-xs font-bold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95"
          >
            Create Client & Dispatch Invite
          </button>
        </div>
      </div>
    {/if}

  </div>

</div>
