<script lang="ts">
  import { fade, slide } from 'svelte/transition';

  // Form State
  let companyName = $state('');
  
  // Client Admin Account State (crucial for actual provisioning)
  let adminFirstName = $state('');
  let adminLastName = $state('');
  let adminEmail = $state('');

  // Branding State
  let isDragging = $state(false);
  let logoUrl = $state<string | null>(null);

  // Auto-Extracted Colors (Default fallback if no logo)
  let primaryHex = $state('#1a56db'); 
  let secondaryHex = $state('#1e429f');
  let fontHex = $state('#ffffff');

  // Helpers for Drag & Drop
  function handleDragOver(e: DragEvent) { e.preventDefault(); isDragging = true; }
  function handleDragLeave() { isDragging = false; }
  
  // Core Color Extraction Logic using Canvas
  function extractDominantColor(imgSrc: string) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0, g = 0, b = 0, count = 0;
      
      // Sample pixels, skipping transparent ones and pure white/black backgrounds
      for (let i = 0; i < data.length; i += 16) { // step by 4 pixels for speed
        if (data[i+3] > 128) {
          const isWhite = data[i] > 240 && data[i+1] > 240 && data[i+2] > 240;
          const isBlack = data[i] < 15 && data[i+1] < 15 && data[i+2] < 15;
          if (!isWhite && !isBlack) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
            count++;
          }
        }
      }
      
      if (count > 0) {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        // Convert to hex
        primaryHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).padStart(6, '0')}`;
      } else {
        primaryHex = '#1a56db'; // default
      }
      generateThemeColors();
    };
    img.src = imgSrc;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) processFile(files[0]);
  }

  function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) processFile(input.files[0]);
  }

  function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    logoUrl = url;
    
    // Auto-extract color from the logo (replaces manual color picker)
    extractDominantColor(url);
  }

  function generateThemeColors() {
    let r = parseInt(primaryHex.slice(1, 3), 16);
    let g = parseInt(primaryHex.slice(3, 5), 16);
    let b = parseInt(primaryHex.slice(5, 7), 16);

    // Darken by 15% for secondary
    let secR = Math.max(0, Math.floor(r * 0.85));
    let secG = Math.max(0, Math.floor(g * 0.85));
    let secB = Math.max(0, Math.floor(b * 0.85));

    secondaryHex = `#${((1 << 24) + (secR << 16) + (secG << 8) + secB).toString(16).slice(1)}`;

    // Determine font color contrast
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    fontHex = brightness > 155 ? '#1e293b' : '#ffffff';
  }

  function handleSaveClient(e: Event) {
    e.preventDefault();
    alert("Tenant provisioned successfully with Admin Account: " + adminEmail);
    // Real implementation will insert into public.tenants and auth.users
  }

</script>

<svelte:head>
  <title>Provision New Client | Super Admin</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto pb-12">
  
  <!-- Header block -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Provision New Client</h1>
      <p class="premium-heading-subtitle">Create a new tenant workspace and assign their primary Client Admin.</p>
    </div>
  </div>

  <div class="max-w-3xl mx-auto">
    
    <!-- Configuration Form -->
    <div class="bg-white rounded-xl border border-slate-100 p-8 shadow-sm space-y-8">
      
      <form onsubmit={handleSaveClient} class="space-y-8">
        
        <!-- Section 1: Tenant Details -->
        <div class="space-y-4">
          <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Tenant Details</h3>
          
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
            <input type="text" bind:value={companyName} placeholder="e.g. Globex Corp" class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" required />
          </div>
        </div>

        <!-- Section 2: Initial Client Admin Account -->
        <div class="space-y-4">
          <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Client Admin Account</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin First Name</label>
              <input type="text" bind:value={adminFirstName} placeholder="e.g. Jane" class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" required />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Last Name</label>
              <input type="text" bind:value={adminLastName} placeholder="e.g. Doe" class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" required />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Email</label>
            <input type="email" bind:value={adminEmail} placeholder="e.g. jane.doe@company.com" class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" required />
            <p class="text-xs text-slate-400">An invitation will be sent to this email to set their password.</p>
          </div>
        </div>

        <!-- Section 3: White-Label Branding (NO Color Picker) -->
        <div class="space-y-4">
          <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">White-Label Branding</h3>
          
          <div class="space-y-5">
            
            <!-- Logo Upload -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Corporate Logo</label>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all {isDragging ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}"
                ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}
                onclick={() => document.getElementById('logoInput')?.click()}
              >
                <input type="file" id="logoInput" accept="image/*" class="hidden" onchange={handleFile} />
                <div class="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                <span class="text-sm font-bold text-slate-500 block">Drag &amp; Drop .PNG / .JPG here, or browse</span>
                <span class="text-xs font-semibold text-primary block mt-1">Our system will automatically extract the primary brand color from this logo.</span>
              </div>
            </div>

            <!-- Extracted Colors Display (Read-Only) -->
            {#if logoUrl}
              <div transition:slide={{axis: 'y'}} class="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <span class="text-xs font-black text-slate-400 uppercase tracking-wider block mb-3">Auto-Extracted Brand Identity</span>
                <div class="flex items-center gap-6">
                  
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full shadow-inner overflow-hidden border-2 border-white shrink-0" style="background-color: {primaryHex}"></div>
                    <div>
                      <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Color</div>
                      <div class="text-sm font-mono font-bold text-slate-700">{primaryHex}</div>
                    </div>
                  </div>

                  <div class="flex gap-4 opacity-70 border-l border-slate-200 pl-6">
                    <div class="space-y-1">
                      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Secondary</span>
                      <div class="flex items-center gap-1.5">
                        <div class="w-4 h-4 rounded" style="background-color: {secondaryHex}"></div>
                        <span class="text-xs font-mono text-slate-600">{secondaryHex}</span>
                      </div>
                    </div>
                    <div class="space-y-1">
                      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Font on Primary</span>
                      <div class="flex items-center gap-1.5">
                        <div class="w-4 h-4 rounded border border-slate-200" style="background-color: {fontHex}"></div>
                        <span class="text-xs font-mono text-slate-600">{fontHex}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            {/if}

          </div>
        </div>

        <button type="submit" class="w-full py-4 bg-slate-900 hover:bg-black text-white text-base font-extrabold rounded-lg shadow-lg transition-all active:scale-95">
          Save & Provision Tenant
        </button>

      </form>
    </div>

  </div>
</div>