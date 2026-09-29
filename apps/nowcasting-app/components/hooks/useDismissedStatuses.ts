import { useCallback, useEffect, useState } from "react";
import { ProductStatus } from "../types";

/**
 * Per-session dismissal of status banner rows.
 *
 * The identity of a dismissal is `${key}:${updatedAt}`, taken straight from the payload.
 * That is what makes "dismiss" mean "I have read *this* incident" rather than "hide this
 * product": when the status changes — a new incident, or an edit to the message — `updatedAt`
 * moves and the row comes back on its own. No hashing, no expiry, nothing to keep in sync
 * with the message text.
 *
 * `updatedAt` is nullable in the spec, so it cannot be used raw. Falling back to `key` alone
 * would give every incident on an unstamped product the same id, and dismissing one would
 * silently swallow the next — so the message stands in as the identity instead, which moves
 * when the incident does.
 *
 * `sessionStorage` rather than `localStorage` is deliberate: an incident dismissed on Monday
 * should not still be hidden on Friday if it is somehow still open.
 */

const STORAGE_KEY = "quartz.dismissedStatuses";

export const statusDismissalId = (status: ProductStatus): string =>
  `${status.key}:${status.updatedAt ?? status.message ?? ""}`;

const readStored = (): string[] => {
  // Guarded for SSR, and for browsers where storage access throws (private mode, blocked
  // cookies). A failure here must degrade to "nothing dismissed", never to a crashed banner.
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
};

const writeStored = (ids: string[]) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Dismissal not persisting is a far smaller problem than the banner failing to render.
  }
};

export const useDismissedStatuses = () => {
  // Starts empty on both server and first client render, then fills from storage in an
  // effect. Reading storage during render would desync the two and trip hydration.
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setDismissedIds(readStored());
  }, []);

  const dismiss = useCallback((status: ProductStatus) => {
    const id = statusDismissalId(status);
    setDismissedIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      writeStored(next);
      return next;
    });
  }, []);

  const isDismissed = useCallback(
    (status: ProductStatus) => dismissedIds.includes(statusDismissalId(status)),
    [dismissedIds]
  );

  return { isDismissed, dismiss };
};
