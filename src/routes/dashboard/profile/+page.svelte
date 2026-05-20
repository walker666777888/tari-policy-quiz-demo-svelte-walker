<script lang="ts">
  import { slide, fade, fly } from 'svelte/transition';

  // Mock Profile Data
  let employeeProfile = $state({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@acme.corp",
    department: "Finance",
    role: "Senior Analyst",
  });

  // Password Update State
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  
  // Notification Preferences State
  let emailReminders = $state(true);
  let newModuleAlerts = $state(true);
  let certificateExpiryAlerts = $state(true);

  // Toast System
  let toastMessage = $state<string | null>(null);
  
  function showToast(message: string) {
    toastMessage = message;
    setTimeout(() => { toastMessage = null; }, 4000);
  }

  function handleUpdateProfile(e: Event) {
    e.preventDefault();
    showToast("✅ Profile details updated successfully!");
  }

  function handleUpdatePassword(e: Event) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("❌ New passwords do not match!");
      return;
    }
    showToast("🔐 Password changed securely.");
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
  }

  function savePreferences() {
    showToast("✉️ Preferences saved successfully.");
  }
</script>

<svelte:head>
  <title>My Profile | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative pb-10 px-1 sm:px-4">

  <!-- Success Notification Toast -->
  {#if toastMessage}
    <div 
      transition:fly={{ y: 20, duration: 300 }}
      class="fixed bottom-6 right-6 z-[100] bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3.5 max-w-sm text-xs font-semibold select-none"
    >
      <span class="text-base shrink-0">{toastMessage.includes('❌') ? '⚠️' : '🔔'}</span>
      <span class="leading-normal">{toastMessage}</span>
    </div>
  {/if}

  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Account &amp; Profile</h1>
      <p class="premium-heading-subtitle text-sm text-muted-foreground font-medium mt-1">Manage your personal details, secure your account, and configure alerts.</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Left Column: Identity & Password -->
    <div class="lg:col-span-2 space-y-8">
      
      <!-- Profile Card -->
      <div in:fly={{ y: 15, duration: 400, delay: 0 }} class="bg-surface rounded-2xl border border-border shadow-sm p-6 group">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Personal Details</h3>
        
        <form onsubmit={handleUpdateProfile} class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-450 uppercase tracking-wider" for="firstName">First Name</label>
              <input type="text" id="firstName" bind:value={employeeProfile.firstName} class="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs bg-slate-50/50 dark:bg-slate-900/50 text-foreground font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all duration-200" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-450 uppercase tracking-wider" for="lastName">Last Name</label>
              <input type="text" id="lastName" bind:value={employeeProfile.lastName} class="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs bg-slate-50/50 dark:bg-slate-900/50 text-foreground font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all duration-200" />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-455 uppercase tracking-wider" for="email">Work Email</label>
            <input type="email" id="email" bind:value={employeeProfile.email} disabled class="w-full border border-border rounded-xl px-4 py-3 text-xs bg-muted text-muted-foreground font-semibold cursor-not-allowed select-none opacity-80" />
            <span class="text-[9.5px] text-muted-foreground font-semibold leading-tight inline-block">Email changes must be formally requested through HR.</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-455 uppercase tracking-wider" for="department">Department</label>
              <input type="text" id="department" bind:value={employeeProfile.department} disabled class="w-full border border-border rounded-xl px-4 py-3 text-xs bg-muted text-muted-foreground font-semibold cursor-not-allowed select-none opacity-80" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-455 uppercase tracking-wider" for="role">Corporate Role</label>
              <input type="text" id="role" bind:value={employeeProfile.role} disabled class="w-full border border-border rounded-xl px-4 py-3 text-xs bg-muted text-muted-foreground font-semibold cursor-not-allowed select-none opacity-80" />
            </div>
          </div>
          
          <div class="pt-4 flex justify-end">
            <button type="submit" class="px-6 py-3 bg-primary hover:opacity-95 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95 cursor-pointer">
              Update Profile Details
            </button>
          </div>
        </form>
      </div>

      <!-- Password Security Card -->
      <div in:fly={{ y: 15, duration: 400, delay: 80 }} class="bg-surface rounded-2xl border border-border shadow-sm p-6">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Security & Authentication</h3>
        
        <form onsubmit={handleUpdatePassword} class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-450 uppercase tracking-wider" for="currPassword">Current Password</label>
            <input type="password" id="currPassword" bind:value={currentPassword} required class="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs bg-slate-50/50 dark:bg-slate-900/50 text-foreground font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm max-w-sm transition-all duration-200" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-450 uppercase tracking-wider" for="newPassword">New Password</label>
              <input type="password" id="newPassword" bind:value={newPassword} required class="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs bg-slate-50/50 dark:bg-slate-900/50 text-foreground font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all duration-200" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-450 uppercase tracking-wider" for="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" bind:value={confirmPassword} required class="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs bg-slate-50/50 dark:bg-slate-900/50 text-foreground font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all duration-200" />
            </div>
          </div>
          
          <div class="pt-4 flex justify-end">
            <button type="submit" class="px-6 py-3 bg-slate-800 dark:bg-slate-700 hover:bg-slate-950 text-white text-xs font-extrabold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
              Change Security Password
            </button>
          </div>
        </form>
      </div>

    </div>

    <!-- Right Column: Preferences -->
    <div class="space-y-8">
      
      <!-- Notifications -->
      <div in:fly={{ y: 15, duration: 400, delay: 160 }} class="bg-surface rounded-2xl border border-border p-6 shadow-sm flex flex-col h-full space-y-6">
        <div>
          <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email Preferences</h3>
          <p class="text-[10px] text-muted-foreground font-semibold mt-1">Control which compliance notifications hit your inbox.</p>
        </div>

        <div class="space-y-6 flex-1">
          <!-- Reminder Toggles with bouncy spring animations -->
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-foreground">Exam Reminders</span>
              <p class="text-[9.5px] text-muted-foreground leading-relaxed">Receive emails when assigned a module with a due date.</p>
            </div>
            <button onclick={() => emailReminders = !emailReminders} class="w-10 h-5.5 rounded-full p-0.5 transition-all duration-300 relative border shrink-0 mt-0.5 cursor-pointer {emailReminders ? 'bg-primary border-primary/20 shadow-inner' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-750'}">
              <div class="w-4 h-4 rounded-full bg-white shadow-md transition-all duration-350 transform {emailReminders ? 'translate-x-4.5 scale-105' : 'translate-x-0'}"></div>
            </button>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-foreground">New Module Alerts</span>
              <p class="text-[9.5px] text-muted-foreground leading-relaxed">Notify me instantly when new policies are launched.</p>
            </div>
            <button onclick={() => newModuleAlerts = !newModuleAlerts} class="w-10 h-5.5 rounded-full p-0.5 transition-all duration-300 relative border shrink-0 mt-0.5 cursor-pointer {newModuleAlerts ? 'bg-primary border-primary/20 shadow-inner' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-750'}">
              <div class="w-4 h-4 rounded-full bg-white shadow-md transition-all duration-350 transform {newModuleAlerts ? 'translate-x-4.5 scale-105' : 'translate-x-0'}"></div>
            </button>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-foreground">Expiry Warnings</span>
              <p class="text-[9.5px] text-muted-foreground leading-relaxed">Alert me 30 days before a certificate expires.</p>
            </div>
            <button onclick={() => certificateExpiryAlerts = !certificateExpiryAlerts} class="w-10 h-5.5 rounded-full p-0.5 transition-all duration-300 relative border shrink-0 mt-0.5 cursor-pointer {certificateExpiryAlerts ? 'bg-primary border-primary/20 shadow-inner' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-750'}">
              <div class="w-4 h-4 rounded-full bg-white shadow-md transition-all duration-350 transform {certificateExpiryAlerts ? 'translate-x-4.5 scale-105' : 'translate-x-0'}"></div>
            </button>
          </div>
        </div>

        <div class="pt-4 border-t border-border flex justify-end mt-auto">
          <button onclick={savePreferences} class="w-full py-3 bg-muted hover:bg-muted/80 border border-border text-muted-foreground hover:text-foreground text-xs font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer">
            Save Notification Preferences
          </button>
        </div>
      </div>

    </div>

  </div>

</div>
