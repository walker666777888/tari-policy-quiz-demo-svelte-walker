import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Initialize from localStorage if in browser, fallback to light mode
const initialValue = browser ? localStorage.getItem('themeMode') === 'dark' : false;

export const isDarkMode = writable(initialValue);

if (browser) {
  isDarkMode.subscribe(value => {
    const root = document.documentElement;
    if (value) {
      root.classList.add('dark');
      localStorage.setItem('themeMode', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('themeMode', 'light');
    }
  });
}
