import { useEffect, useState } from "react";

/**
 * Role tokens, for the things that cannot take a class name.
 *
 * Mapbox and Recharts take colours as *values*, so `bg-surface/50` is not available to them —
 * the `/50` modifier is a class-name feature Tailwind applies when it generates CSS. Reading
 * the token out of `tailwind.config` does not help either: roles are stored as the template
 * `rgb(var(--surface) / <alpha-value>)`, and `<alpha-value>` is invalid CSS, so it reaches the
 * browser and is discarded silently — no error, no colour.
 *
 * So read the variable itself. `styles/tokens.css` stores every role as space-separated RGB
 * channels (`--surface: 20 21 21`) precisely so it can be composed with any alpha, here or in
 * a class. Doing it at runtime rather than at build time also means these follow the theme:
 * flip to light and the chart's colours move with everything else, which importing a literal
 * could never do.
 */

/** Read one role token and compose it with an alpha. Browser only — see `useTokens`. */
export const readToken = (name: string, alpha = 1): string | null => {
  if (typeof window === "undefined") return null;
  const channels = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!channels) return null;
  return alpha === 1 ? `rgb(${channels})` : `rgb(${channels} / ${alpha})`;
};

export type TokenRequest = {
  /** CSS custom property, including the leading dashes — e.g. `--surface-panel`. */
  name: string;
  alpha?: number;
  /** Used for the server render and for the frame before the first read. */
  fallback: string;
};

/**
 * Resolve role tokens to concrete colours, re-resolving when the theme changes.
 *
 * The fallback covers the server render and the first client frame, so it should be the dark
 * value — that is the default theme, and matching it means no flash for the common case.
 *
 * The observer is what makes light mode work here: the theme is a class on `<html>`, and
 * nothing else would tell a chart that its colours had moved underneath it.
 */
export const useTokens = <T extends Record<string, TokenRequest>>(
  requests: T
): Record<keyof T, string> => {
  const resolve = () =>
    Object.fromEntries(
      Object.entries(requests).map(([key, r]) => [key, readToken(r.name, r.alpha) ?? r.fallback])
    ) as Record<keyof T, string>;

  const [colours, setColours] = useState<Record<keyof T, string>>(
    () =>
      Object.fromEntries(Object.entries(requests).map(([key, r]) => [key, r.fallback])) as Record<
        keyof T,
        string
      >
  );

  // `requests` is an object literal at every call site, so it is a new reference each render.
  // Keying the effect on its resolved shape rather than the object avoids an infinite loop.
  const signature = JSON.stringify(requests);

  useEffect(() => {
    setColours(resolve());
    const observer = new MutationObserver(() => setColours(resolve()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return colours;
};
