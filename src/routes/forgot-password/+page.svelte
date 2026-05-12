<script lang="ts">
	/**
	 * src/routes/forgot-password/+page.svelte
	 *
	 * Three-step forgot-password wizard:
	 *   Step 1  →  Enter email  →  POST /api/auth/request-reset
	 *   Step 2  →  Enter OTP   →  POST /api/auth/verify-reset-otp  →  receive resetToken (memory only)
	 *   Step 3  →  Set password →  POST /api/auth/reset-password   →  navigate to /login
	 *
	 * The resetToken is kept in component memory ($state) — never written to
	 * localStorage or sessionStorage.  Refreshing the page returns to step 1.
	 */

	import type { PageData } from './$types'

	let { data: _data }: { data: PageData } = $props()

	// ── Wizard state ───────────────────────────────────────────────────────────
	type Step = 1 | 2 | 3 | 'done'
	let step = $state<Step>(1)

	// ── Shared ─────────────────────────────────────────────────────────────────
	let email        = $state('')
	let loading      = $state(false)
	let errorMsg     = $state<string | null>(null)
	let submitted    = $state(false)

	// ── Step 2 ─────────────────────────────────────────────────────────────────
	let otp              = $state('')
	let otpTokenExpiry   = $state<string | null>(null)   // display only
	let attemptsLeft     = $state<number | null>(null)

	// ── Step 3 ─────────────────────────────────────────────────────────────────
	let resetToken       = $state('')   // from step-2 API response — memory only
	let password         = $state('')
	let confirmPassword  = $state('')
	let showPassword     = $state(false)
	let passwordExpiry   = $state<string | null>(null)   // display only

	// ── Validation ─────────────────────────────────────────────────────────────
	const emailError = $derived(
		submitted && step === 1 && !email.trim() ? 'Email is required.' : null
	)
	const otpError = $derived(
		submitted && step === 2 && !/^\d{6}$/.test(otp.trim()) ? 'Please enter the 6-digit code.' : null
	)
	const passwordError = $derived(
		submitted && step === 3 && password.trim().length < 8
			? 'Password must be at least 8 characters.'
			: null
	)
	const confirmError = $derived(
		submitted && step === 3 && password !== confirmPassword
			? 'Passwords do not match.'
			: null
	)

	// ── Helpers ─────────────────────────────────────────────────────────────────
	function resetError () {
		errorMsg      = null
		attemptsLeft  = null
	}

	function formatExpiry (iso: string): string {
		try {
			return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		} catch {
			return ''
		}
	}

	// ── Step 1: Request reset code ─────────────────────────────────────────────
	async function handleRequestReset (e: SubmitEvent) {
		e.preventDefault()
		submitted = true
		if (emailError) return
		resetError()
		loading = true
		try {
			const res    = await fetch('/api/auth/request-reset', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim() }),
			})
			const result = await res.json()
			if (!result.ok) {
				errorMsg = result.error?.message ?? 'Something went wrong. Please try again.'
				return
			}
			// Always advance to step 2 — anti-enumeration (even if email not found)
			submitted = false
			step = 2
		} catch {
			errorMsg = 'Could not reach the server. Please check your connection.'
		} finally {
			loading = false
		}
	}

	// ── Step 2: Verify OTP ─────────────────────────────────────────────────────
	async function handleVerifyOtp (e: SubmitEvent) {
		e.preventDefault()
		submitted = true
		if (otpError) return
		resetError()
		loading = true
		try {
			const res    = await fetch('/api/auth/verify-reset-otp', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
			})
			const result = await res.json()
			if (!result.ok) {
				errorMsg     = result.error?.message ?? 'Verification failed. Please try again.'
				attemptsLeft = result.error?.attemptsRemaining ?? null
				if (result.error?.code === 'MAX_ATTEMPTS') {
					// Locked — send them back to step 1 to request a new code
					setTimeout(() => { step = 1; submitted = false; otp = '' }, 3000)
				}
				return
			}
			// Store reset token in memory — never persist to localStorage
			resetToken    = result.data.resetToken
			passwordExpiry = result.data.expiresAt ? formatExpiry(result.data.expiresAt) : null
			submitted = false
			step = 3
		} catch {
			errorMsg = 'Could not reach the server. Please check your connection.'
		} finally {
			loading = false
		}
	}

	// ── Step 3: Set new password ───────────────────────────────────────────────
	async function handleResetPassword (e: SubmitEvent) {
		e.preventDefault()
		submitted = true
		if (passwordError || confirmError) return
		resetError()
		loading = true
		try {
			const res    = await fetch('/api/auth/reset-password', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), resetToken, password }),
			})
			const result = await res.json()
			if (!result.ok) {
				errorMsg = result.error?.message ?? 'Could not reset password. Please try again.'
				// If session expired, send back to step 1
				if (result.error?.code === 'EXPIRED' || result.error?.code === 'INVALID_TOKEN') {
					setTimeout(() => { step = 1; submitted = false; otp = ''; resetToken = '' }, 3500)
				}
				return
			}
			step = 'done'
		} catch {
			errorMsg = 'Could not reach the server. Please check your connection.'
		} finally {
			loading = false
		}
	}

	// ── Resend: go back to step 1 without clearing email ──────────────────────
	function handleResend () {
		otp       = ''
		resetToken = ''
		errorMsg  = null
		submitted = false
		step      = 1
	}
</script>

<svelte:head>
	<title>Reset password — Tari Policy Quiz</title>
</svelte:head>

<div class="page">
	<div class="card">

		<!-- ── Header ──────────────────────────────────────────────────────── -->
		<div class="header">
			<div class="logo-mark" aria-hidden="true">T</div>
			<h1 class="app-name">Tari Policy Quiz</h1>
			<p class="subtitle">
				{#if step === 1}Reset your password
				{:else if step === 2}Check your email
				{:else if step === 3}Set a new password
				{:else}Password reset complete
				{/if}
			</p>
		</div>

		<!-- ── Progress dots ───────────────────────────────────────────────── -->
		{#if step !== 'done'}
			<div class="progress" role="list" aria-label="Steps">
				{#each [1, 2, 3] as s}
					<div
						class="dot"
						class:dot--active={step === s}
						class:dot--done={typeof step === 'number' && step > s}
						role="listitem"
						aria-current={step === s ? 'step' : undefined}
					>
						{#if typeof step === 'number' && step > s}✓{:else}{s}{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- ── Error banner ────────────────────────────────────────────────── -->
		{#if errorMsg}
			<div class="error-banner" role="alert">
				<span class="error-icon" aria-hidden="true">⚠</span>
				<p class="error-text">{errorMsg}</p>
			</div>
		{/if}

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- STEP 1 — Enter email                                               -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		{#if step === 1}
			<p class="step-hint">
				Enter your email address and we'll send you a 6-digit reset code.
			</p>
			<form onsubmit={handleRequestReset} novalidate>
				<div class="field" class:field--error={!!emailError}>
					<label for="email" class="label">Email address</label>
					<input
						id="email"
						type="email"
						class="input"
						bind:value={email}
						autocomplete="username"
						placeholder="you@company.com"
						aria-describedby={emailError ? 'email-error' : undefined}
						aria-invalid={emailError ? 'true' : undefined}
						disabled={loading}
					/>
					{#if emailError}
						<span id="email-error" class="field-error" role="alert">{emailError}</span>
					{/if}
				</div>

				<button type="submit" class="btn-primary" disabled={loading}>
					{#if loading}
						<span class="spinner" aria-hidden="true"></span>Sending code…
					{:else}
						Send reset code
					{/if}
				</button>
			</form>
			<div class="footer-links">
				<a href="/login" class="back-link">← Back to sign in</a>
			</div>

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- STEP 2 — Enter OTP                                                 -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		{:else if step === 2}
			<p class="step-hint">
				We sent a 6-digit code to <strong>{email}</strong>.
				{#if otpTokenExpiry}The code expires at {otpTokenExpiry}.{/if}
			</p>
			<form onsubmit={handleVerifyOtp} novalidate>
				<div class="field" class:field--error={!!otpError}>
					<label for="otp" class="label">Reset code</label>
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
						<span class="spinner" aria-hidden="true"></span>Verifying…
					{:else}
						Verify code
					{/if}
				</button>
			</form>
			<div class="footer-links">
				<button type="button" class="text-btn" onclick={handleResend} disabled={loading}>
					Didn't receive a code? Resend
				</button>
			</div>

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- STEP 3 — Set new password                                          -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		{:else if step === 3}
			<p class="step-hint">
				Choose a new password.
				{#if passwordExpiry}This session expires at {passwordExpiry}.{/if}
			</p>
			<form onsubmit={handleResetPassword} novalidate>

				<div class="field" class:field--error={!!passwordError}>
					<label for="password" class="label">New password</label>
					<div class="input-row">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
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
							onclick={() => { showPassword = !showPassword }}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							tabindex="-1"
						>{showPassword ? '🙈' : '👁'}</button>
					</div>
					{#if passwordError}
						<span id="pw-error" class="field-error" role="alert">{passwordError}</span>
					{:else}
						<span id="pw-hint" class="field-hint">Minimum 8 characters</span>
					{/if}
				</div>

				<div class="field" class:field--error={!!confirmError}>
					<label for="confirm" class="label">Confirm new password</label>
					<input
						id="confirm"
						type={showPassword ? 'text' : 'password'}
						class="input"
						bind:value={confirmPassword}
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
						<span class="spinner" aria-hidden="true"></span>Resetting password…
					{:else}
						Reset password
					{/if}
				</button>
			</form>

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- DONE                                                               -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		{:else}
			<div class="success-box" role="status">
				<div class="success-icon" aria-hidden="true">✓</div>
				<p class="success-text">
					Your password has been reset successfully.
				</p>
			</div>
			<a href="/login" class="btn-primary btn-link">Sign in with your new password</a>
		{/if}

	</div>
</div>

<style>
	/* ── Layout ──────────────────────────────────────────────────────────────── */
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
		max-width: 400px;
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
		padding: 2.5rem 2rem;
	}

	/* ── Header ──────────────────────────────────────────────────────────────── */
	.header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.logo-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: #2563eb;
		color: #fff;
		border-radius: 12px;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
	}

	.app-name {
		margin: 0 0 0.25rem;
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
	}

	.subtitle {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* ── Progress dots ───────────────────────────────────────────────────────── */
	.progress {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.dot {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		background: #e5e7eb;
		color: #9ca3af;
		transition: background-color 0.2s, color 0.2s;
	}

	.dot--active {
		background: #2563eb;
		color: #fff;
	}

	.dot--done {
		background: #16a34a;
		color: #fff;
		font-size: 0.875rem;
	}

	/* ── Step hint ───────────────────────────────────────────────────────────── */
	.step-hint {
		font-size: 0.875rem;
		color: #4b5563;
		margin: 0 0 1.25rem;
		line-height: 1.5;
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

	.error-text {
		margin: 0;
		font-size: 0.875rem;
		color: #dc2626;
		line-height: 1.5;
	}

	/* ── Form fields ─────────────────────────────────────────────────────────── */
	form {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.field { display: flex; flex-direction: column; gap: 0.375rem; }

	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

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
		font-size: 1.5rem;
		letter-spacing: 0.5em;
		text-align: center;
		font-weight: 700;
	}

	.input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.input:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }

	.field--error .input { border-color: #f87171; }
	.field--error .input:focus {
		border-color: #ef4444;
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
	}

	.field-error  { font-size: 0.8125rem; color: #ef4444; }
	.field-hint   { font-size: 0.8125rem; color: #9ca3af; }
	.attempts-hint { font-size: 0.8125rem; color: #d97706; font-weight: 500; }

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

	.btn-link { display: flex; }   /* anchor styled as button */

	/* ── Spinner ─────────────────────────────────────────────────────────────── */
	@keyframes spin { to { transform: rotate(360deg); } }

	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	/* ── Footer links ────────────────────────────────────────────────────────── */
	.footer-links {
		margin-top: 1.25rem;
		text-align: center;
	}

	.back-link {
		font-size: 0.8125rem;
		color: #6b7280;
		text-decoration: none;
	}
	.back-link:hover { color: #374151; text-decoration: underline; }

	.text-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.8125rem;
		color: #2563eb;
		padding: 0;
	}
	.text-btn:hover { text-decoration: underline; }
	.text-btn:disabled { color: #93c5fd; cursor: not-allowed; }

	/* ── Success state ───────────────────────────────────────────────────────── */
	.success-box {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.success-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		background: #dcfce7;
		color: #16a34a;
		border-radius: 50%;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.success-text {
		margin: 0;
		font-size: 0.9375rem;
		color: #374151;
		line-height: 1.5;
	}
</style>
