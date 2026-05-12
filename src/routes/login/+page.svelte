<script lang="ts">
	/**
	 * src/routes/login/+page.svelte
	 *
	 * Employee / admin login page.
	 * Submits credentials to POST /api/auth/login (server-side signIn via @supabase/ssr).
	 * On success: navigates to role-specific destination returned by the API.
	 */

	import type { PageData } from './$types'

	let { data: _data }: { data: PageData } = $props()

	// ── Form state ─────────────────────────────────────────────────────────────
	let email       = $state('')
	let password    = $state('')
	let loading     = $state(false)
	let errorCode   = $state<string | null>(null)
	let errorMsg    = $state<string | null>(null)
	let showPassword = $state(false)

	// ── Field-level validation (live, post first submit) ──────────────────────
	let submitted = $state(false)

	const emailError    = $derived(submitted && !email.trim()    ? 'Email is required.'    : null)
	const passwordError = $derived(submitted && !password        ? 'Password is required.' : null)
	const hasFieldError = $derived(!!emailError || !!passwordError)

	// ── Submit ─────────────────────────────────────────────────────────────────
	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		submitted    = true
		errorCode    = null
		errorMsg     = null

		if (hasFieldError) return

		loading = true

		try {
			const res = await fetch('/api/auth/login', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ email: email.trim(), password }),
			})

			const result = await res.json()

			if (result.ok) {
				// Session cookies are already set server-side.
				// Hard-navigate so hooks.server.ts picks up the new session.
				window.location.href = result.data.redirectTo
				return
			}

			errorCode = result.error?.code   ?? 'UNKNOWN'
			errorMsg  = result.error?.message ?? 'Login failed. Please try again.'

		} catch {
			errorCode = 'NETWORK_ERROR'
			errorMsg  = 'Could not reach the server. Please check your connection and try again.'
		} finally {
			loading = false
		}
	}
</script>

<svelte:head>
	<title>Sign in — Tari Policy Quiz</title>
</svelte:head>

<div class="page">
	<div class="card">

		<!-- ── Logo / header ───────────────────────────────────────────────── -->
		<div class="header">
			<div class="logo-mark" aria-hidden="true">T</div>
			<h1 class="app-name">Tari Policy Quiz</h1>
			<p class="subtitle">Sign in to your account</p>
		</div>

		<!-- ── Error banner ────────────────────────────────────────────────── -->
		{#if errorMsg && !hasFieldError}
			<div
				class="error-banner"
				class:activation-hint={errorCode === 'ACCOUNT_NOT_ACTIVATED'}
				role="alert"
			>
				<span class="error-icon" aria-hidden="true">
					{errorCode === 'ACCOUNT_NOT_ACTIVATED' ? '✉' : '⚠'}
				</span>
				<p class="error-text">{errorMsg}</p>
			</div>
		{/if}

		<!-- ── Form ────────────────────────────────────────────────────────── -->
		<form onsubmit={handleSubmit} novalidate>

			<!-- Email -->
			<div class="field" class:field--error={!!emailError}>
				<label for="email" class="label">Email address</label>
				<input
					id="email"
					type="email"
					name="email"
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

			<!-- Password -->
			<div class="field" class:field--error={!!passwordError}>
				<label for="password" class="label">Password</label>
				<div class="input-row">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						name="password"
						class="input"
						bind:value={password}
						autocomplete="current-password"
						placeholder="••••••••"
						aria-describedby={passwordError ? 'password-error' : undefined}
						aria-invalid={passwordError ? 'true' : undefined}
						disabled={loading}
					/>
					<button
						type="button"
						class="toggle-pw"
						onclick={() => { showPassword = !showPassword }}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						tabindex="-1"
					>
						{showPassword ? '🙈' : '👁'}
					</button>
				</div>
				{#if passwordError}
					<span id="password-error" class="field-error" role="alert">{passwordError}</span>
				{/if}
			</div>

			<!-- Submit -->
			<button type="submit" class="btn-primary" disabled={loading}>
				{#if loading}
					<span class="spinner" aria-hidden="true"></span>
					Signing in…
				{:else}
					Sign in
				{/if}
			</button>

		</form>

		<!-- ── Footer links ────────────────────────────────────────────────── -->
		<div class="footer-links">
			<p class="footer-hint">
				First time here? Check your email for an activation code.
			</p>
			<a href="/forgot-password" class="forgot-link">Forgot your password?</a>
		</div>

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
		margin-bottom: 2rem;
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

	.error-banner.activation-hint {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.error-icon {
		flex-shrink: 0;
		font-size: 1rem;
		line-height: 1.5;
	}

	.error-text {
		margin: 0;
		font-size: 0.875rem;
		color: #dc2626;
		line-height: 1.5;
	}

	.activation-hint .error-text {
		color: #1d4ed8;
	}

	/* ── Form fields ─────────────────────────────────────────────────────────── */
	form {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

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

	.input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.input:disabled {
		background: #f9fafb;
		color: #9ca3af;
		cursor: not-allowed;
	}

	.field--error .input {
		border-color: #f87171;
	}

	.field--error .input:focus {
		border-color: #ef4444;
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
	}

	.field-error {
		font-size: 0.8125rem;
		color: #ef4444;
	}

	/* ── Password row ────────────────────────────────────────────────────────── */
	.input-row {
		position: relative;
		display: flex;
	}

	.input-row .input {
		padding-right: 2.75rem;
	}

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

	.toggle-pw:hover {
		color: #374151;
	}

	/* ── Submit button ───────────────────────────────────────────────────────── */
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
	}

	.btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn-primary:active:not(:disabled) {
		transform: scale(0.99);
	}

	.btn-primary:disabled {
		background: #93c5fd;
		cursor: not-allowed;
	}

	/* ── Spinner ─────────────────────────────────────────────────────────────── */
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	/* ── Footer ──────────────────────────────────────────────────────────────── */
	.footer-links {
		margin-top: 1.5rem;
		text-align: center;
	}

	.footer-hint {
		margin: 0 0 0.5rem;
		font-size: 0.8125rem;
		color: #9ca3af;
		line-height: 1.5;
	}

	.forgot-link {
		font-size: 0.8125rem;
		color: #2563eb;
		text-decoration: none;
	}
	.forgot-link:hover { text-decoration: underline; }
</style>
