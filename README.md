# CompliancePro Enterprise — Policy Quiz System

CompliancePro is a high-end, multi-tenant compliance SaaS platform built with SvelteKit, TailwindCSS, and Supabase. This repository contains the frontend web application and its integration scripts.

This project is fully portable and ready for team development and seamless deployment on **Vercel**.

---

## 🚀 Getting Started

Follow these steps to clone, configure, and run the project locally on your system.

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) installed on your system.

### 2. Clone the Repository
```bash
git clone <repository-url>
cd tari-policy-quiz
```
*(Or unzip the project folder and open your terminal inside it).*

### 3. Setup Environment Variables
Before running the app, copy the template `.env.example` file to create your local `.env` file:
```bash
cp .env.example .env
```
Open the `.env` file and populate it with your local/development credentials:
- **Supabase credentials** (obtainable from your Supabase Project Settings → API):
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (secret, server-side only)
- **Application URL**:
  - `PUBLIC_APP_URL` (defaults to `http://localhost:5173`)
- **Email service**:
  - `RESEND_API_KEY` (Resend API key to enable email sending, optional for local dev)

### 4. Install Dependencies
```bash
npm install
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

---

## 🏗️ Production Build & Verification

To verify that the project compiles correctly and is ready for production deployment:
```bash
# Build the application
npm run build

# Preview the built application locally
npm run preview
```

---

## ⚡ Vercel Deployment Guide

CompliancePro is designed to be fully compatible with Vercel and uses `@sveltejs/adapter-vercel` automatically under production environments.

### 1. Framework Settings
When importing this project to Vercel, use the following configuration:
* **Framework Preset:** `SvelteKit` (automatically detected by Vercel)
* **Build Command:** `npm run build`
* **Output Directory:** Default SvelteKit output (automatically handled by the Vercel adapter)

### 2. Environment Variables
Add the following environment variables in your Vercel Project Settings:
* `PUBLIC_SUPABASE_URL`
* `PUBLIC_SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY`
* `PUBLIC_APP_URL` (set to your production domain, e.g. `https://your-app.vercel.app`)
* `RESEND_API_KEY` (optional, for email functionality)

No additional configuration (`vercel.json`) is required, as SvelteKit detects the Vercel build environment and configures the native SvelteKit adapter accordingly.
