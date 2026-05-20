import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const initialValue = browser ? localStorage.getItem('themeMode') === 'dark' : false;

export const isDarkMode = writable(initialValue);

if (browser) {
  // Apply the theme class immediately on load without transition
  const root = document.documentElement;
  if (initialValue) {
    root.classList.add('dark');
  }

  let isInitial = true;

  isDarkMode.subscribe(value => {
    if (isInitial) {
      isInitial = false;
      return; // Skip the first subscribe call (already applied above)
    }

    const root = document.documentElement;

    // Use the View Transitions API for a buttery-smooth crossfade if available
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        if (value) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        localStorage.setItem('themeMode', value ? 'dark' : 'light');
      });
    } else {
      // Fallback: inject transition class briefly for browsers without View Transitions API
      root.classList.add('theme-transitioning');
      if (value) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem('themeMode', value ? 'dark' : 'light');
      setTimeout(() => root.classList.remove('theme-transitioning'), 600);
    }
  });
}
