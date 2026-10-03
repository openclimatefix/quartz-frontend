import { FC } from "react";

import Spinner from "../icons/spinner";

/**
 * What the server renders, and what the browser shows for the one frame before the app mounts.
 *
 * Paired with `ClientOnly` — see that file for why the dashboard is not server-rendered. The
 * job here is narrow: hold the viewport at the app's own black so the first paint is not a
 * white flash, and say that something is coming. It deliberately draws no chrome — no header,
 * no rails, no panel outlines. A skeleton of the real layout would be a second copy of the
 * shell's geometry to keep in step with `dashboard-shell.tsx`, and it would be wrong the moment
 * either moved.
 */
const BootScreen: FC = () => (
  // No `role="status"` here: `Spinner` already carries one, and nesting two live regions makes
  // a screen reader announce the same thing twice.
  <div className="flex h-screen w-full items-center justify-center bg-surface-sunken">
    <Spinner />
  </div>
);

export default BootScreen;
