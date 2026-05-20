import { writable } from 'svelte/store';

export type ThemeTransitionState = {
  active: boolean;
  targetMode: 'dark' | 'light';
};

export const themeTransition = writable<ThemeTransitionState>({
  active: false,
  targetMode: 'light',
});
