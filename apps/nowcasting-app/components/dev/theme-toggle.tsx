import { useEffect, useState } from "react";

/**
 * TEMPORARY — a bare light/dark flip for judging the reskin by eye. Delete once the
 * palette is settled, or replace with a real preference (system + persisted + a control
 * that lives somewhere sensible) if we decide light mode ships.
 *
 * The class goes on <html> because that is where `.theme-light` in `styles/tokens.css`
 * redefines the role variables. Applied in an effect rather than during render so the
 * server-rendered markup and the first client render agree — see the country cookie
 * hydration fix for the same reasoning.
 */
const STORAGE_KEY = "ocf-theme-preview";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode or blocked storage — fall back to dark, which is the default anyway.
    }
    setLight(stored === "light");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("theme-light", light);
    try {
      window.localStorage.setItem(STORAGE_KEY, light ? "light" : "dark");
    } catch {
      // Not being able to remember the choice does not stop it applying now.
    }
  }, [light, ready]);

  return (
    <button
      type="button"
      onClick={() => setLight((v) => !v)}
      title="Preview the other theme (temporary)"
      className="fixed bottom-3 left-3 z-[100] flex items-center gap-2 rounded-full border border-edge bg-surface-panel px-3 py-1.5 text-xs font-medium text-content shadow-lg transition-colors hover:bg-surface-raised"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full border-2 border-content-on-accent ${
          light ? "bg-interactive" : "bg-surface-raised"
        }`}
      />
      {light ? "Light" : "Dark"}
    </button>
  );
}
