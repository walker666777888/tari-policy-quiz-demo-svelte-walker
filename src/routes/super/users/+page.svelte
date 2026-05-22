<script lang="ts">
  type UserRole = "Client Admin" | "Employee";
  type UserStatus = "Active" | "Suspended";
  type User = {
    id: string;
    email: string;
    name: string;
    tenant: string;
    role: UserRole;
    status: UserStatus;
    joinedDate: string;
  };

  // Svelte 5 Runes for fully functional User Management sandbox
  let isSandboxActive = $state(false);
  let searchQuery = $state("");
  let roleFilter = $state<"All" | UserRole>("All");
  let statusFilter = $state<"All" | UserStatus>("All");
  let showModal = $state(false);
  let selectedUserId = $state("usr-1");

  // Form states for provisioning a new user
  let newName = $state("");
  let newEmail = $state("");
  let newTenant = $state("Acme Corp Financial");
  let newRole = $state<UserRole>("Employee");

  // Dynamic sandbox users list (reactive state)
  let usersList = $state<User[]>([
    { id: 'usr-1', email: 'admin@acme.com', name: 'Sarah Connor', tenant: 'Acme Corp Financial', role: 'Client Admin', status: 'Active', joinedDate: 'Oct 01, 2023' },
    { id: 'usr-2', email: 'engineer@globex.org', name: 'John Doe', tenant: 'Globex Healthcare', role: 'Employee', status: 'Active', joinedDate: 'Oct 05, 2023' },
    { id: 'usr-3', email: 'hr@initech.co', name: 'Bill Lumbergh', tenant: 'Initech Solutions', role: 'Client Admin', status: 'Suspended', joinedDate: 'Sep 25, 2023' },
    { id: 'usr-4', email: 'manager@soylent.com', name: 'Robert Neville', tenant: 'Soylent Logistics', role: 'Client Admin', status: 'Active', joinedDate: 'Sep 12, 2023' }
  ]);

  // Derived filtered users list
  let filteredUsers = $derived(
    isSandboxActive
      ? usersList.filter(u => {
          const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                u.tenant.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesRole = roleFilter === "All" || u.role === roleFilter;
          const matchesStatus = statusFilter === "All" || u.status === statusFilter;
          return matchesSearch && matchesRole && matchesStatus;
        })
      : []
  );

  // Derived counts
  let totalUsers = $derived(isSandboxActive ? usersList.length : null);
  let activeUsers = $derived(isSandboxActive ? usersList.filter(u => u.status === "Active").length : null);

  // Details for selected user
  let selectedUserData = $derived(
    usersList.find(u => u.id === selectedUserId) || usersList[0]
  );

  // provision user handler
  function handleProvisionUser(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    usersList = [
      ...usersList,
      {
        id: `usr-${usersList.length + 1}`,
        name: newName,
        email: newEmail,
        tenant: newTenant,
        role: newRole,
        status: 'Active' as const,
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      }
    ];

    // Reset and close
    newName = "";
    newEmail = "";
    newTenant = "Acme Corp Financial";
    newRole = "Employee";
    showModal = false;
  }

  // Toggle user active/suspended state
  function toggleUserStatus(userId: string) {
    usersList = usersList.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          status: u.status === 'Active' ? 'Suspended' as const : 'Active' as const
        };
      }
      return u;
    });
  }
</script>

<svelte:head>
  <title>User Directory - Super Admin | CompliancePro</title>
</svelte:head>

<div class="animate-fade-in space-y-8 max-w-6xl mx-auto">
  
  <!-- Header Section -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
    <div class="premium-heading-group">
      <h1 class="premium-heading-title">User Management</h1>
      <p class="premium-heading-subtitle">Provision Client Admin credentials and manage user access states.</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- Sandbox Mode Toggle -->
      <button 
        onclick={() => isSandboxActive = !isSandboxActive}
        class="px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center gap-2
          {isSandboxActive 
            ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' 
            : 'bg-surface text-muted-foreground border-border hover:bg-muted hover:border-border'}"
      >
        <span>{isSandboxActive ? '🟢 Live Sandbox: ON' : '⚫ Sandbox Mode: OFF'}</span>
      </button>

      <button 
        onclick={() => showModal = true}
        disabled={!isSandboxActive}
        class="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Provision User
      </button>
    </div>
  </div>

  <!-- Database Connection Banner -->
  <div class="p-4 rounded-xl border transition-all duration-300 hover:shadow-sm
    {isSandboxActive 
      ? 'bg-success/10/50 border-teal-200/60' 
      : 'bg-muted border-border/60'}">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 {isSandboxActive ? 'bg-teal-400' : 'bg-slate-400'}"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 {isSandboxActive ? 'bg-teal-500' : 'bg-slate-500'}"></span>
        </span>
        <div>
          <div class="text-sm font-bold text-foreground">
            {isSandboxActive ? 'Connected to Identity Providers' : 'Database Connection Pending'}
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {isSandboxActive 
              ? 'Database simulation active. Global user directories, status overrides, and client provisioning are live!' 
              : 'Supabase offline. Toggle Sandbox Mode to synchronize platform accounts from auth.users & public.users.'}
          </p>
        </div>
      </div>
      <div class="text-[10px] font-mono px-2.5 py-1 rounded bg-surface text-muted-foreground border border-border transition-all hover:bg-muted">
        {isSandboxActive ? 'auth.users [LIVE]' : 'auth.users [AWAITING]'}
      </div>
    </div>
  </div>

  <!-- Stats Cards Grid (With Micro-Lift Hovers) -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Provisioned Users</div>
        <div class="mt-2 text-2xl font-extrabold text-foreground">
          {totalUsers !== null ? totalUsers : '—'}
        </div>
      </div>
      <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">auth.users</span>
    </div>
    
    <div class="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Credentials</div>
        <div class="mt-2 text-2xl font-extrabold text-foreground">
          {activeUsers !== null ? activeUsers : '—'}
        </div>
      </div>
      <span class="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors duration-200 hover:bg-primary/10">public.users</span>
    </div>
  </div>

  <!-- Main Directory Section -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <!-- User Directory Directory -->
    <div class="lg:col-span-2 bg-surface rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-sm">
      <!-- Search & Filters Toolbar -->
      <div class="p-6 border-b border-border space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 class="text-sm font-bold text-foreground">User Directory</h2>
          
          <input 
            type="text" 
            bind:value={searchQuery}
            disabled={!isSandboxActive}
            placeholder="Search by name, email, or tenant..." 
            class="w-full sm:w-60 border border-border rounded-lg px-3 py-1.5 text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-slate-350" 
          />
        </div>

        <!-- Filter Selectors -->
        <div class="flex flex-wrap gap-2.5">
          <select 
            bind:value={roleFilter}
            disabled={!isSandboxActive}
            class="border border-border rounded-lg px-3 py-1.5 text-[11px] bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-border"
          >
            <option value="All">All Roles</option>
            <option value="Client Admin">Client Admins</option>
            <option value="Employee">Employees</option>
          </select>

          <select 
            bind:value={statusFilter}
            disabled={!isSandboxActive}
            class="border border-border rounded-lg px-3 py-1.5 text-[11px] bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm disabled:opacity-50 transition-all hover:border-border"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      <!-- Live Directory Table (With Row Slide Micro-Animations) -->
      {#if isSandboxActive}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="bg-muted text-muted-foreground uppercase font-bold tracking-wider">
              <tr>
                <th class="px-6 py-3 border-b border-border">User Details</th>
                <th class="px-6 py-3 border-b border-border">Client Tenant</th>
                <th class="px-6 py-3 border-b border-border">Role</th>
                <th class="px-6 py-3 border-b border-border">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              {#each filteredUsers as user}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <tr 
                  onclick={() => selectedUserId = user.id}
                  class="cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:translate-x-0.5
                    {selectedUserId === user.id ? 'bg-primary/5 font-semibold text-primary' : 'text-foreground/90'}"
                >
                  <td class="px-6 py-4">
                    <div class="font-bold text-foreground">{user.name}</div>
                    <div class="text-[10px] text-muted-foreground mt-0.5">{user.email}</div>
                  </td>
                  <td class="px-6 py-4 text-muted-foreground">{user.tenant}</td>
                  <td class="px-6 py-4 text-muted-foreground font-semibold">{user.role}</td>
                  <td class="px-6 py-4">
                    <span class="px-2.5 py-0.5 text-[9px] font-bold rounded-full transition-all duration-200 hover:scale-105 inline-block
                      {user.status === 'Active' ? 'bg-success/10 text-success border border-success/20/50' : ''}
                      {user.status === 'Suspended' ? 'bg-destructive/10 text-destructive border border-destructive/20/50' : ''}">
                      {user.status}
                    </span>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="4" class="px-6 py-12 text-center text-muted-foreground">
                    No matching users found in directory.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <!-- Empty State -->
        <div class="p-16 flex flex-col justify-center items-center text-center space-y-3 min-h-[300px]">
          <div class="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary transition-all duration-350 hover:scale-110">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <div class="space-y-1">
            <h3 class="text-xs font-bold text-foreground/90">Database Connection Required</h3>
            <p class="text-[11px] text-muted-foreground max-w-xs leading-normal">
              Connect your local Supabase database to synchronize live identities and credentials directories.
            </p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Right Side Actions & Details Panel -->
    <div class="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-6 transition-all duration-300 hover:shadow-sm">
      <h2 class="text-sm font-bold text-foreground border-b border-border/60 pb-3">User Telemetry</h2>
      
      {#if isSandboxActive && selectedUserData}
        <div class="space-y-5 animate-fade-in">
          <div>
            <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Access Details</div>
            <div class="mt-2 text-sm font-bold text-foreground">{selectedUserData.name}</div>
            <div class="text-xs text-muted-foreground mt-0.5">{selectedUserData.email}</div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs text-muted-foreground border-b border-border/60 py-1 transition-colors hover:bg-muted px-1 rounded">
              <span>Joined Platform</span>
              <span class="font-bold text-foreground">{selectedUserData.joinedDate}</span>
            </div>
            <div class="flex justify-between text-xs text-muted-foreground border-b border-border/60 py-1 transition-colors hover:bg-muted px-1 rounded">
              <span>Client Affiliation</span>
              <span class="font-bold text-foreground truncate max-w-[150px]">{selectedUserData.tenant}</span>
            </div>
            <div class="flex justify-between text-xs text-muted-foreground py-1 transition-colors hover:bg-muted px-1 rounded">
              <span>Current Role</span>
              <span class="font-bold text-foreground">{selectedUserData.role}</span>
            </div>
          </div>

          <!-- Sandbox Actions Button triggers live status override -->
          <div class="pt-4 border-t border-border flex flex-col gap-2">
            <button 
              onclick={() => toggleUserStatus(selectedUserData.id)}
              class="w-full px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                {selectedUserData.status === 'Active' 
                  ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-red-100/70 hover:border-red-200' 
                  : 'bg-success/10 text-success border-success/20 hover:bg-teal-100/70 hover:border-teal-200'}"
            >
              {selectedUserData.status === 'Active' ? '⛔ Suspend Platform Credentials' : '✅ Re-activate Credentials'}
            </button>
            
            <button 
              onclick={() => alert(`Simulated master password reset link dispatched to actor: ${selectedUserData.email}`)}
              class="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-muted text-foreground/90 border border-border hover:bg-muted transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              🔐 Send Master Password Reset
            </button>
          </div>
        </div>
      {:else}
        <div class="text-center text-muted-foreground text-xs py-12">
          Select a user node to analyze access profiles and manage credentials.
        </div>
      {/if}
    </div>

  </div>

  <!-- Dynamic New User Provisioning Modal -->
  {#if showModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      onclick={() => showModal = false}
      class="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div 
        onclick={(e) => e.stopPropagation()}
        class="bg-surface rounded-xl shadow-xl border border-border w-full max-w-md overflow-hidden"
      >
        <div class="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
          <h3 class="text-sm font-bold text-foreground">Provision Client Admin Node</h3>
          <button onclick={() => showModal = false} class="text-muted-foreground hover:text-muted-foreground font-bold text-base transition-colors hover:rotate-90 duration-200">&times;</button>
        </div>
        
        <form onsubmit={handleProvisionUser} class="p-6 space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="fullName">Full Name</label>
            <input 
              id="fullName"
              type="text" 
              bind:value={newName}
              required
              placeholder="e.g. Sarah Connor" 
              class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="emailAddr">Email Address</label>
            <input 
              id="emailAddr"
              type="email" 
              bind:value={newEmail}
              required
              placeholder="e.g. admin@acme.com" 
              class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all hover:border-slate-350"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="tenantSelect">Client Tenant Affiliation</label>
            <select 
              id="tenantSelect"
              bind:value={newTenant}
              class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-surface transition-all hover:border-border"
            >
              <option>Acme Corp Financial</option>
              <option>Globex Healthcare</option>
              <option>Initech Solutions</option>
              <option>Soylent Logistics</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-muted-foreground" for="roleSelect">Credential Access Level</label>
            <select 
              id="roleSelect"
              bind:value={newRole}
              class="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm bg-surface transition-all hover:border-border"
            >
              <option value="Client Admin">Client Admin (HR / Manager)</option>
              <option value="Employee">Employee (Assessment Taker)</option>
            </select>
          </div>

          <div class="pt-4 border-t border-border flex justify-end gap-2.5">
            <button 
              type="button" 
              onclick={() => showModal = false}
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground border border-border hover:bg-muted transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white border border-primary/20 hover:bg-primary/95 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Provision Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>
