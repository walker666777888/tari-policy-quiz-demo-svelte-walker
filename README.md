# 🛡️ CompliancePro Enterprise

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**CompliancePro** is a high-end, multi-tenant compliance SaaS platform built with SvelteKit, TailwindCSS, and Supabase. Designed for enterprise scale, it features a highly polished, responsive UI with advanced routing and robust role-based access control.

---

## ✨ Key Features

- 🏢 **Multi-Tenant Architecture:** Seamlessly manage multiple clients, each with distinct environments and branding.
- 🔐 **Role-Based Portals:** Dedicated dashboards for Super Admins, Client Admins, and Employees.
- 🎨 **Premium UI/UX:** Built with TailwindCSS, featuring a responsive design, glassmorphism effects, and an elegant dark mode.
- 📱 **Mobile-First Responsiveness:** Fully adaptive layouts that look perfect on desktops, tablets, and smartphones.
- ⚡ **Seamless Deployment:** Native support for zero-config deployments on Vercel.

---

## 🚀 Getting Started

Follow these instructions to set up the project locally for development and testing.

### 1. Prerequisites

Ensure you have **Node.js** (v18 or higher) installed on your system.

### 2. Clone the Repository

```bash
git clone https://github.com/walker666777888/tari-policy-quiz-demo-svelte-walker.git
cd tari-policy-quiz
```

### 3. Environment Configuration

Before running the app, duplicate the `.env.example` file to create your local `.env` configuration file:

```bash
cp .env.example .env
```

Populate the `.env` file with your local/development credentials:

- **Supabase Configuration:** (Find these in your Supabase Project Settings → API)
  - `PUBLIC_SUPABASE_URL`: Your Supabase project URL.
  - `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous API key.
  - `SUPABASE_SERVICE_ROLE_KEY`: Your secret service role key (Server-side only).
- **Application URL:**
  - `PUBLIC_APP_URL`: Defaults to `http://localhost:5173`.
- **Email Service (Optional):**
  - `RESEND_API_KEY`: API key for the Resend email service.

### 4. Install Dependencies

```bash
npm install
```

### 5. Launch the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application in real-time.

---

## 🏗️ Production Build & Verification

To verify that the project compiles correctly and is ready for production deployment, run the following commands:

```bash
# Build the application for production
npm run build

# Preview the built application locally
npm run preview
```

---

## ☁️ Vercel Deployment Guide

CompliancePro is optimized for Vercel and automatically uses the `@sveltejs/adapter-vercel` adapter in production environments.

### Framework Configuration

When importing this repository to Vercel, use the following configuration:
- **Framework Preset:** `SvelteKit` (Automatically detected)
- **Build Command:** `npm run build`
- **Output Directory:** Handled automatically by the SvelteKit adapter.

### Environment Variables

Remember to add the following Environment Variables in your Vercel **Project Settings**:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_APP_URL` (Set to your production domain, e.g., `https://your-app.vercel.app`)
- `RESEND_API_KEY` (Optional)

> **Note:** No additional `vercel.json` configuration is required. SvelteKit automatically detects the Vercel build environment and adapts perfectly.
