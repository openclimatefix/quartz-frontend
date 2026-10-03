import { useMemo } from "react";

import { getCountryConfig } from "../../config/countries";
import { useGenerationSources } from "../../hooks/data";
import type { GenerationSourceCapability, Scope } from "../../lib/domain/types";

/**
 * Which observed-generation stream the map is drawn against — decided in one place.
 *
 * The map's "actual" (and therefore its whole delta fill) comes from exactly one observer, and
 * until now that was `generationSources.data[0]`: whichever the manifest happened to list
 * first. For GB that is `pvlive_in_day` — **PV Live Estimated** — so the delta map has always
 * shown "current forecast vs the in-day estimate", never "vs the best actual we have". That is
 * a defensible thing to show and it was not written down anywhere on screen, which is the
 * actual defect; see `docs/forecast-delta-merge.md` Part 2.
 *
 * Two things follow, and this module is both of them:
 *
 * 1. **The name is config, not an array index.** `mapObserver` in the country registry.
 * 2. **The label comes back with it**, so the legend and the popup say what the number is
 *    rather than calling it "Actual" and leaving the user to guess which actual.
 *
 * The fallback to `[0]` is deliberate and is *not* the old behaviour wearing a hat: it fires
 * only when the configured name is absent from the manifest, where the alternatives are
 * sending an observer the API 400s on (`"Observer 'x' is not available for NL solar"`) or
 * drawing no generation at all. Falling back keeps the map working and — because the label
 * travels with the choice — the screen names whatever was actually used, so the substitution
 * is visible rather than silent.
 *
 * Not a country branch: the preference is a registry field, and a country with no entry gets
 * the manifest's first entry exactly as every country did before.
 */
export const resolveMapObserver = (
  country: string | null | undefined,
  sources: GenerationSourceCapability[] | undefined
): GenerationSourceCapability | undefined => {
  if (!sources?.length) return undefined;
  const preferred = getCountryConfig(country)?.mapObserver;
  return sources.find((entry) => entry.name === preferred) ?? sources[0];
};

export type MapObserver = {
  /** `undefined` until the manifest lands — hold the generation request until it is known. */
  observer: GenerationSourceCapability | undefined;
  /** The observer's display name, or `undefined` while unresolved. Never invent a fallback. */
  label: string | undefined;
  isLoading: boolean;
};

/**
 * `resolveMapObserver` against the live manifest.
 *
 * `useGenerationSources` is a slice of the `/countries` response the header already holds, so
 * the legend calling this costs no request beyond the one the map's values pipeline makes —
 * they share the manifest's single cache entry.
 */
export const useMapObserver = (
  scope: Pick<Scope, "country" | "source"> | null | undefined
): MapObserver => {
  const sources = useGenerationSources(scope);
  const observer = useMemo(
    () => resolveMapObserver(scope?.country, sources.data),
    [scope?.country, sources.data]
  );
  return { observer, label: observer?.label, isLoading: sources.isLoading };
};
