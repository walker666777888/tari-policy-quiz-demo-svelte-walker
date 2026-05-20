import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Standard mock supabase export if needed (replace with your real $lib/supabase or SSR logic)
// import { supabase } from '$lib/supabase';

export const theme = writable({
  companyName: 'CompliancePro',
  primaryColor: '#1a56db',
  secondaryColor: '#1e429f',
  fontColor: '#ffffff',
  logoUrl: ''
});

// Helper: Convert Hex to RGB Space for Tailwind CSS Custom Properties
function hexToRgbSpace(hex: string): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export async function loadTheme(tenantId: string) {
  // Mock DB call: Normally await supabase.from('tenants').select('*').eq('id', tenantId).single()
  // For the sake of the demo, we will simulate the response based on the tenantId
  let data = {
    company_name: 'CompliancePro',
    primary_color: '#1a56db',
    secondary_color: '#1e429f',
    font_color: '#ffffff',
    logo_url: ''
  };

  if (tenantId === 'demo-globex') {
    data = { company_name: 'Globex Healthcare', primary_color: '#2b6cb0', secondary_color: '#1a4971', font_color: '#ffffff', logo_url: '' };
  } else if (tenantId === 'demo-initech') {
    data = { company_name: 'Initech Solutions', primary_color: '#276749', secondary_color: '#184531', font_color: '#ffffff', logo_url: '' };
  } else if (tenantId === 'demo-acme') {
    data = { company_name: 'Acme Corp Financial', primary_color: '#e53e3e', secondary_color: '#c53030', font_color: '#ffffff', logo_url: '' };
  }

  // Update Svelte store
  theme.set({
    companyName: data.company_name,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    fontColor: data.font_color,
    logoUrl: data.logo_url,
  });

  // Inject into CSS variables
  if (browser) {
    const root = document.documentElement;
    // For direct hardcoded usages:
    root.style.setProperty('--primary', data.primary_color);
    root.style.setProperty('--secondary', data.secondary_color);
    root.style.setProperty('--font-color', data.font_color);
    
    // For Tailwind space-separated rgba compat (rgb(var(--color-primary) / <alpha-value>)):
    root.style.setProperty('--color-primary', hexToRgbSpace(data.primary_color));
  }
}
