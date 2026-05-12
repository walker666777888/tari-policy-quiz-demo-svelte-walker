<script lang="ts">
	/**
	 * src/routes/auth/verify-otp/+page.svelte
	 *
	 * Activation page for invited employees.
	 * Linked from the invite email: /auth/verify-otp?email=<encoded-email>
	 *
	 * Two completion paths (mutually exclusive — both consume the OTP):
	 *
	 *   Path A — Magic link  : POST /api/auth/verify-otp
	 *               → activates account + returns a Supabase magic link
	 *               → client follows the link to establish a session automatically
	 *
	 *   Path B — Set password: POST /api/auth/set-password
	 *               → activates account + sets a chosen password
	 *               → client is redirected to /login to sign in with new credentials
	 *
	 * The page starts on the OTP step. After OTP is verified via Path A the magic
	 * link is followed immediately. Path B shows a second step to choose a password.
	 */
	import type { PageData } from './$types'

	let { data: _data }: { data: PageData } = $props()

	// ── URL param: email pre-filled from invite link ────────────────────────────
	// Only runs in the browser — avoids SSR issues with URLSearchParams.
	let emailFromUrl = ''
	if (typeof window !== 'undefined') {
		emailFromUrl = new URLSearchParams(window.location.search).get('email') ?? ''
	}

	// ── Wizard state ────────────────────────────────────────────────────────────
	type Step = 'otp' | 'set-password' | 'done' | 'error'
	let step = $state<Step>('otp')

	// ── Form fields ─────────────────────────────────────────────────────────────
	let email       = $state(emailFromUrl)
	let otp         = $state('')
	let password    = $state('')
	let confirmPw   = $state('')
	let showPw      = $state(false)

	// ── UI state ─────────────────────────────────────────────────────────────────
	let loading       = $state(false)
	let submitted     = $state(false)
	let errorMsg      = $state<string | null>(null)
	let attemptsLeft  = $state<number | null>(null)
	let successMsg    = $state<string | null>(null)

	// Path choice: 'magic' uses verify-otp; 'password' uses set-password.
	// Default to 'magic' (one-click activation). User can toggle.
	let activationPath = $state<'magic' | 'password'>('magic')

	// ── Validation ───────────────────────────────────────────────────────────────
	const emailError = $derived(
		submitted && step === 'otp' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
			? 'Please enter a valid email address.'
			: null
	)
	const otpError = $derived(
		submitted && step === 'otp' && !/^\d{6}$/.test(otp.trim())
			? 'Please enter the 6-digit code from your email.'
			: null
	)
	const passwordError = $derived(
		submitted && step === 'set-password' && password.trim().length < 8
			? 'Password must be at least 8 characters.'
			: null
	)
	const confirmError = $derived(
		submitted && step === 'set-password' && password !== confirmPw
			? 'Passwords do not match.'
			: null
	)

	// ── Path A: verify OTP → magic link ─────────────────────────────────────────
	async function handleMagicLink (e: SubmitEvent) {
		e.preventDefault()
		submitted = true
		errorMsg  = null
		attemptsLeft = null

		if (emailError || otpError) return

		loading = true
		try {
			const res    = await fetch('/api/auth/verify-otp', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ email: email.trim(), otp: otp.trim() }),
			})
			const result = await res.json()

			if (result.ok) {
				if (result.data?.magicLink) {
					// Follow magic link — Supabase exchanges token, sets session, redirects to app
					window.location.href = result.data.magicLink
				} else {
					// Activated but link generation failed — go to login
					step      = 'done'
					successMsg = result.data?.message ?? 'Account activated. Please sign in.'
				}
				return
			}

			errorMsg     = result.error?.message ?? 'Verification failed. Please try again.'
			attemptsLeft = result.error?.attemptsRemaining ?? null

			if (result.error?.code === 'MAX_ATTEMPTS') {
				step = 'error'
			}
		} catch {
			errorMsg = 'Could not reach the server. Please check your connection.'
		} finally {
			loading = false
		}
	}

	// ── Path B step 1: verify OTP and advance to password form ──────────────────
	// Reuses the same set-password endpoint which consumes OTP + sets password.
	// We split it into 2 UI steps for clarity, but it's a single API call.
	function goToPasswordStep (e: SubmitEvent) {
		e.preventDefault()
		submitted = true
		errorMsg  = null

		if (emailError || otpError) return

		submitted = false
		step = 'set-password'
	}

	// ── Path B step 2: submit OTP + password together ───────────────────────────
	async function handleSetPassword (e: SubmitEvent) {
		e.preventDefault()
		submitted = true
		errorMsg  = null

		if (passwordError || confirmError) return

		loading = true
		try {
			const res    = await fetch('/api/auth/set-password', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({
					email:    email.trim(),
					otp:      otp.trim(),
					password,
				}),
			})
			const result = await res.json()

			if (result.ok) {
				step       = 'done'
				successMsg = 'Your account is active. You can now sign in with your new password.'
				return
			}

			// OTP may have already been consumed by a concurrent magic-link attempt
			// or by a prior call. In either case, guide user to login.
			errorMsg = result.error?.message ?? 'Activation failed. Please contact your administrator.'

			if (result.error?.code === 'MAX_ATTEMPTS' || result.error?.code === 'ALREADY_USED') {
				step = 'error'
			} else {
				// Go back to OTP step to re-enter
				step      = 'otp'
				submitted = false
			}
		} catch {
			errorMsg = 'Could not reach the server. Please check your connection.'
		} finally {
			loading = false
		}
	}
</script>

<svelte:head>
	<title>Activate your account — Tari Policy Quiz</title>
</svelte:head>

<div class="page">
	<div class="card">

		<!-- ── Header ──────────────────────────────────────────────────────── -->
		<div class="header">
			<div class="logo-mark" aria-hidden="true">T</div>
			<h1 class="app-name">Tari Policy Quiz</h1>
			<p class="subtitle">
				{#if step === 'otp'}Activate your account
				{:else if step === 'set-password'}Choose a password
				{:else if step === 'done'}Account activated
				{:else}Activation failed
				{/if}
			</p>
		</div>

		<!-- ── Error banner ────────────────────────────────────────────────── -->
		{#if errorMsg}
			<div class="error-banner" role="alert">
				<span class="error-icon" aria-hidden="true">⚠</span>
				<p class="error-text">{errorMsg}</p>
			</div>
		{/if}

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- STEP: Enter OTP                                                   -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		{#if step === 'otp'}
			<p class="hint">
				Enter the 6-digit code from your invitation email to activate your account.
			</p>

			<!-- Path toggle -->
			<div class="path-toggle" role="group" aria-label="Activation method">
				<button
					type="button"
					class="path-btn"
					class:path-btn--active={activationPath === 'magic'}
					onclick={() => { activationPath = 'magic' }}
				>
					One-click activation
				</button>
				<button
					type="button"
					class="path-btn"
					class:path-btn--active={activationPath === 'password'}
					onclick={() => { activationPath = 'password' }}
				>
					Set a password
				</button>
			</div>

			<form onsubmit={activationPath === 'magic' ? handleMagicLink : goToPasswordStep} novalidate>

				<!-- Email -->
				<div class="field" class:field--error={!!emailError}>
					<label for="email" class="label">Email address</label>
					<input
						id="email"
						type="email"
						class="input"
						bind:value={email}
						autocomplete="username"
						autocapitalize="none"
						spellcheck="false"
						placeholder="you@company.com"
						aria-describedby={emailError ? 'email-error' : undefined}
						aria-invalid={emailError ? 'true' : undefined}
						disabled={loading}
					/>
					{#if emailError}
						<span id="email-error" class="field-error" role="alert">{emailError}</span>
					{/if}
				</div>

				<!-- OTP -->
				<div class="field" class:field--error={!!otpError}>
					<label for="otp" class="label">Activation code</label>
					<input
						id="otp"
						type="text"
						inputmode="numeric"
						pattern="\d{6}"
						maxlength="6"
						class="input input--otp"
						bind:value={otp}
						autocomplete="one-time-code"
						placeholder="000000"
						aria-describedby={otpError ? 'otp-error' : undefined}
						aria-invalid={otpError ? 'true' : undefined}
						disabled={loading}
					/>
					{#if otpError}
						<span id="otp-error" class="field-error" role="alert">{otpError}</span>
					{/if}
					{#if attemptsLeft !== null && attemptsLeft > 0}
						<span class="attempts-hint">{attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining</span>
					{/if}
				</div>

				<button type="submit" class="btn-primary" disabled={loading}>
					{#if loading}
						<span class="spinner" aria-hidden="true"></span>
						{activationPath === 'magic' ? 'Activating…' : 'Continuing…'}
					{:else}
						{activationPath === 'magic' ? 'Activate my account' : 'Continue'}
					{/if}
				</button>
			</form>

			<div class="footer-links">
				<a href="/login" class="back-link">← Back to sign in</a>
			</div>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- STEP: Choose password (Path B step 2)                            -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		{:else if step === 'set-password'}
			<p class="hint">
				Choose a password for your account. You'll use this to sign in going forward.
			</p>

			<form onsubmit={handleSetPassword} novalidate>

				<div class="field" class:field--error={!!passwordError}>
					<label for="password" class="label">New password</label>
					<div class="input-row">
						<input
							id="password"
							type={showPw ? 'text' : 'password'}
							class="input"
							bind:value={password}
							autocomplete="new-password"
							placeholder="At least 8 characters"
							aria-describedby={passwordError ? 'pw-error' : 'pw-hint'}
							aria-invalid={passwordError ? 'true' : undefined}
							disabled={loading}
						/>
						<button
							type="button"
							class="toggle-pw"
							onclick={() => { showPw = !showPw }}
							aria-label={showPw ? 'Hide password' : 'Show password'}
							tabindex="-1"
						>{showPw ? '🙈' : '👁'}</button>
					</div>
					{#if passwordError}
						<span id="pw-error" class="field-error" role="alert">{passwordError}</span>
					{:else}
						<span id="pw-hint" class="field-hint">Minimum 8 characters</span>
					{/if}
				</div>

				<div class="field" class:field--error={!!confirmError}>
					<label for="confirm" class="label">Confirm password</label>
					<input
						id="confirm"
						type={showPw ? 'text' : 'password'}
						class="input"
						bind:value={confirmPw}
						autocomplete="new-password"
						placeholder="Repeat your password"
						aria-describedby={confirmError ? 'confirm-error' : undefined}
						aria-invalid={confirmError ? 'true' : undefined}
						disabled={loading}
					/>
					{#if confirmError}
						<span id="confirm-error" class="field-error" role="alert">{confirmError}</span>
					{/if}
				</div>

				<button type="submit" class="btn-primary" disabled={loading}>
					{#if loading}
						<span class="spinner" aria-hidden="true"></span>Activating…
					{:else}
						Set password &amp; activate
					{/if}
				</button>
			</form>

			<div class="footer-links">
				<button
					type="button"
					class="back-link-btn"
					onclick={() => { step = 'otp'; submitted = false; errorMsg = null }}
					disabled={loading}
				>
					← Back
				</button>
			</div>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- DONE                                                              -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		{:else if step === 'done'}
			<div class="success-box" role="status">
				<div class="success-icon" aria-hidden="true">✓</div>
				<p class="success-text">
					{successMsg ?? 'Your account has been activated successfully.'}
				</p>
			</div>
			<a href="/login" class="btn-primary btn-link">Sign in to your account</a>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- ERROR (locked / admin must resend)                               -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		{:else}
			<div class="error-box" role="status">
				<div class="error-box-icon" aria-hidden="true">✕</div>
				<p class="error-box-text">
					Your activation code has been locked or used. Please contact your
					administrator to resend your invitation.
				</p>
			</div>
			<a href="/login" class="btn-secondary btn-link">Go to sign in</a>
		{/if}

	</div>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f1f5f9;
		padding: 1rem;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.card {
		width: 100%;
		max-width: 420px;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
		padding: 2.5rem 2rem;
	}

	/* ── Header ──────────────────────────────────────────────────────────────── */
	.header { text-align: center; margin-bottom: 1.5rem; }

	.logo-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px; height: 48px;
		background: #2563eb;
		color: #fff;
		border-radius: 12px;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
	}

	.app-name { margin: 0 0 0.25rem; font-size: 1.25rem; font-weight: 700; color: #111827; }
	.subtitle { margin: 0; font-size: 0.875rem; color: #6b7280; }

	/* ── Hint ────────────────────────────────────────────────────────────────── */
	.hint { font-size: 0.875rem; color: #4b5563; margin: 0 0 1.25rem; line-height: 1.5; }

	/* ── Path toggle ─────────────────────────────────────────────────────────── */
	.path-toggle {
		display: flex;
		background: #f3f4f6;
		border-radius: 8px;
		padding: 3px;
		margin-bottom: 1.25rem;
		gap: 2px;
	}

	.path-btn {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		background: transparent;
		color: #6b7280;
		transition: background-color 0.15s, color 0.15s;
	}

	.path-btn--active {
		background: #fff;
		color: #111827;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	/* ── Error banner ────────────────────────────────────────────────────────── */
	.error-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
	}

	.error-icon { flex-shrink: 0; font-size: 1rem; line-height: 1.5; }
	.error-text { margin: 0; font-size: 0.875rem; color: #dc2626; line-height: 1.5; }

	/* ── Form ────────────────────────────────────────────────────────────────── */
	form { display: flex; flex-direction: column; gap: 1.125rem; }
	.field { display: flex; flex-direction: column; gap: 0.375rem; }
	.label { font-size: 0.875rem; font-weight: 500; color: #374151; }

	.input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1.5px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.9375rem;
		color: #111827;
		background: #fff;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
		box-sizing: border-box;
	}

	.input--otp {
		font-size: 1.75rem;
		letter-spacing: 0.5em;
		text-align: center;
		font-weight: 700;
	}

	.input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
	.input:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
	.field--error .input { border-color: #f87171; }
	.field--error .input:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }

	.field-error    { font-size: 0.8125rem; color: #ef4444; }
	.field-hint     { font-size: 0.8125rem; color: #9ca3af; }
	.attempts-hint  { font-size: 0.8125rem; color: #d97706; font-weight: 500; }

	/* ── Password row ────────────────────────────────────────────────────────── */
	.input-row { position: relative; display: flex; }
	.input-row .input { padding-right: 2.75rem; }

	.toggle-pw {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		padding: 0.25rem;
		color: #6b7280;
		border-radius: 4px;
		line-height: 1;
	}
	.toggle-pw:hover { color: #374151; }

	/* ── Buttons ─────────────────────────────────────────────────────────────── */
	.btn-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 1rem;
		margin-top: 0.5rem;
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s, transform 0.1s;
		text-decoration: none;
	}

	.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
	.btn-primary:active:not(:disabled) { transform: scale(0.99); }
	.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
	.btn-link { display: flex; }

	.btn-secondary {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.75rem 1rem;
		margin-top: 0.5rem;
		background: transparent;
		color: #374151;
		border: 1.5px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
	}
	.btn-secondary:hover { background: #f9fafb; }

	/* ── Spinner ─────────────────────────────────────────────────────────────── */
	@keyframes spin { to { transform: rotate(360deg); } }

	.spinner {
		display: inline-block;
		width: 16px; height: 16px;
		border: 2px solid rgba(255,255,255,0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	/* ── Footer links ────────────────────────────────────────────────────────── */
	.footer-links { margin-top: 1.25rem; text-align: center; }

	.back-link {
		font-size: 0.8125rem;
		color: #6b7280;
		text-decoration: none;
	}
	.back-link:hover { color: #374151; text-decoration: underline; }

	.back-link-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.8125rem;
		color: #6b7280;
		padding: 0;
	}
	.back-link-btn:hover { color: #374151; text-decoration: underline; }
	.back-link-btn:disabled { color: #9ca3af; cursor: not-allowed; }

	/* ── Success / Error state ───────────────────────────────────────────────── */
	.success-box, .error-box {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.success-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px; height: 56px;
		background: #dcfce7;
		color: #16a34a;
		border-radius: 50%;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.error-box-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px; height: 56px;
		background: #fef2f2;
		color: #dc2626;
		border-radius: 50%;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.success-text, .error-box-text {
		margin: 0;
		font-size: 0.9375rem;
		color: #374151;
		line-height: 1.5;
	}
</style>
