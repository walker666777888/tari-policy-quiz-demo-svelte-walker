import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { themeTransition } from './themeTransition';
import { get } from 'svelte/store';

const initialValue = browser ? localStorage.getItem('themeMode') === 'dark' : false;

export const isDarkMode = writable(initialValue);

// Apply initial class with no animation
if (browser) {
  if (initialValue) {
    document.documentElement.classList.add('dark');
  }
}

export function toggleTheme() {
  if (!browser) return;

  const currentDark = get(isDarkMode);
  const next = !currentDark;

  // 1. Show the premium overlay
  themeTransition.set({ active: true, targetMode: next ? 'dark' : 'light' });

  // 2. After the overlay has expanded and is covering the screen, swap the class
  setTimeout(() => {
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('themeMode', next ? 'dark' : 'light');
    isDarkMode.set(next);
  }, 420);

  // 3. Hide the overlay after the class swap is done
  setTimeout(() => {
    themeTransition.set({ active: false, targetMode: next ? 'dark' : 'light' });
  }, 1100);
}
