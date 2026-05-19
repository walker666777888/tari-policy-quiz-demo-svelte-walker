<script lang="ts">
  import { slide, fade } from 'svelte/transition';

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
    showToast("✅ Profile information successfully updated!");
  }

  function handleUpdatePassword(e: Event) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("❌ New passwords do not match!");
      return;
    }
    showToast("🔐 Account password securely updated.");
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
  }

  function savePreferences() {
    showToast("✉️ Notification preferences successfully saved.");
  }
</script>

<svelte:head>
  <title>My Profile | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-7xl mx-auto relative pb-10">

  <!-- Success Notification Toast -->
  {#if toastMessage}
    <div 
      transition:slide={{axis: 'y'}}
      class="fixed top-6 right-6 z-[100] bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl px-5 py-3.5 flex items-center gap-3 max-w-sm text-xs font-semibold"
    >
      <span class="text-base">{toastMessage.includes('❌') ? '⚠️' : '🔔'}</span>
      <span>{toastMessage}</span>
    </div>
  {/if}

  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">Account &amp; Profile</h1>
      <p class="premium-heading-subtitle">Manage your personal details, secure your account, and configure alerts.</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Left Column: Identity & Password -->
    <div class="lg:col-span-2 space-y-8">
      
      <!-- Profile Card -->
      <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-6">Personal Details</h3>
        
        <form onsubmit={handleUpdateProfile} class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="firstName">First Name</label>
              <input type="text" id="firstName" bind:value={employeeProfile.firstName} class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="lastName">Last Name</label>
              <input type="text" id="lastName" bind:value={employeeProfile.lastName} class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="email">Work Email</label>
            <input type="email" id="email" bind:value={employeeProfile.email} disabled class="w-full border border-slate-100 rounded-lg px-3 py-2 text-xs bg-slate-100 text-slate-400 font-semibold cursor-not-allowed" />
            <span class="text-[9px] text-slate-400 font-medium">Email changes must be requested through HR.</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="department">Department</label>
              <input type="text" id="department" bind:value={employeeProfile.department} disabled class="w-full border border-slate-100 rounded-lg px-3 py-2 text-xs bg-slate-100 text-slate-400 font-semibold cursor-not-allowed" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="role">Corporate Role</label>
              <input type="text" id="role" bind:value={employeeProfile.role} disabled class="w-full border border-slate-100 rounded-lg px-3 py-2 text-xs bg-slate-100 text-slate-400 font-semibold cursor-not-allowed" />
            </div>
          </div>
          
          <div class="pt-4 flex justify-end">
            <button type="submit" class="px-5 py-2.5 bg-primary hover:opacity-95 text-white text-xs font-bold rounded-lg shadow-md shadow-primary/10 transition-all active:scale-95">
              Update Profile
            </button>
          </div>
        </form>
      </div>

      <!-- Password Security Card -->
      <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-6">Security & Authentication</h3>
        
        <form onsubmit={handleUpdatePassword} class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="currPassword">Current Password</label>
            <input type="password" id="currPassword" bind:value={currentPassword} required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm max-w-sm" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="newPassword">New Password</label>
              <input type="password" id="newPassword" bind:value={newPassword} required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" for="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" bind:value={confirmPassword} required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" />
            </div>
          </div>
          
          <div class="pt-4 flex justify-end">
            <button type="submit" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95">
              Change Password
            </button>
          </div>
        </form>
      </div>

    </div>

    <!-- Right Column: Preferences -->
    <div class="space-y-8">
      
      <!-- Notifications -->
      <div class="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col h-full space-y-6">
        <div>
          <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Email Preferences</h3>
          <p class="text-[10px] text-slate-400 font-medium mt-1">Control which compliance notifications hit your inbox.</p>
        </div>

        <div class="space-y-5 flex-1">
          <!-- Reminder Toggles -->
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-slate-800">Exam Reminders</span>
              <p class="text-[9px] text-slate-400 leading-normal">Receive emails when assigned a module with a due date.</p>
            </div>
            <button onclick={() => emailReminders = !emailReminders} class="w-10 h-5 rounded-full p-0.5 transition-colors relative border duration-200 shrink-0 mt-0.5 {emailReminders ? 'bg-primary border-primary/25' : 'bg-slate-200 border-slate-300'}">
              <div class="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 transform {emailReminders ? 'translate-x-5' : 'translate-x-0'}"></div>
            </button>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-slate-800">New Module Alerts</span>
              <p class="text-[9px] text-slate-400 leading-normal">Notify me instantly when new policies are launched.</p>
            </div>
            <button onclick={() => newModuleAlerts = !newModuleAlerts} class="w-10 h-5 rounded-full p-0.5 transition-colors relative border duration-200 shrink-0 mt-0.5 {newModuleAlerts ? 'bg-primary border-primary/25' : 'bg-slate-200 border-slate-300'}">
              <div class="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 transform {newModuleAlerts ? 'translate-x-5' : 'translate-x-0'}"></div>
            </button>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-slate-800">Expiry Warnings</span>
              <p class="text-[9px] text-slate-400 leading-normal">Alert me 30 days before a certificate expires.</p>
            </div>
            <button onclick={() => certificateExpiryAlerts = !certificateExpiryAlerts} class="w-10 h-5 rounded-full p-0.5 transition-colors relative border duration-200 shrink-0 mt-0.5 {certificateExpiryAlerts ? 'bg-primary border-primary/25' : 'bg-slate-200 border-slate-300'}">
              <div class="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 transform {certificateExpiryAlerts ? 'translate-x-5' : 'translate-x-0'}"></div>
            </button>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex justify-end mt-auto">
          <button onclick={savePreferences} class="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all active:scale-95">
            Save Preferences
          </button>
        </div>
      </div>

    </div>

  </div>

</div>
