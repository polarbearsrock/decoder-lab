/* Runs before the stylesheet to apply the saved theme without a light flash. */
(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'decoder-lab-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const normalize = value => ['light', 'dark'].includes(value) ? value : 'system';
  let preference = 'system';
  let control;

  try {
    preference = normalize(localStorage.getItem(storageKey));
  } catch {
    // The theme still works when browser storage is unavailable.
  }

  function applyTheme() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0e1621' : '#f6f8fa';
    if (control) control.value = preference;
  }

  applyTheme();
  system.addEventListener('change', applyTheme);

  document.addEventListener('DOMContentLoaded', () => {
    control = document.getElementById('theme-select');
    if (!control) return;
    control.value = preference;
    control.addEventListener('change', () => {
      preference = normalize(control.value);
      applyTheme();
      try {
        if (preference === 'system') localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, preference);
      } catch {
        // Keep the selection for this page even when it cannot be saved.
      }
    });
  });

  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      preference = normalize(event.newValue);
      applyTheme();
    }
  });
})();
