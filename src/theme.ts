// Dark/light theme. Follows the device until the user picks; the pick is the only thing we remember.
const KEY = "chatwrap-theme";
export const themeButton = (id: string) => `<button type="button" class="theme-btn" id="${id}" aria-label="Switch dark or light mode" title="Dark / light">
  <svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="currentColor"/></svg>
  <svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>
</button>`;
export function bindTheme(id: string) {
  document.getElementById(id)?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  });
}
