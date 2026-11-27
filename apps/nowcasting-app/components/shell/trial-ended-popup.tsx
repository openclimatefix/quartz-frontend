import React, { useState } from "react";
import useGlobalState from "../helpers/globalState";
import { CloseButtonIcon } from "../icons/icons";

/** Shown once per page load when the trial has expired. */
const TrialEndedPopup: React.FC = () => {
  const [trialExpiredAt] = useGlobalState("trialExpiredAt");
  const [dismissed, setDismissed] = useState(false);
  if (!trialExpiredAt || dismissed) return null;

  const close = () => setDismissed(true);
  return (
    <>
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="trial-ended-title"
        className="fixed bottom-4 right-4 h-[50vh] z-50 flex w-[min(calc(100vw-2rem),40rem)] flex-col items-center justify-center gap-3 rounded-2xl bg-[#121212] px-8 py-16 text-center text-white shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 text-neutral-400 hover:text-white"
        >
          <CloseButtonIcon />
        </button>
        <p className="text-base">Your OCF Energy trial has now ended.</p>
        <h2
          id="trial-ended-title"
          className="text-4xl font-semibold tracking-tight text-neutral-300"
        >
          So, how did it go?
        </h2>
        <p className="mt-4 text-sm text-neutral-400">
          Ready to subscribe, or need some more time to evaluate? No problem.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          <a
            href="mailto:support@ocf.energy?subject=Trial%20extension%20request"
            className="whitespace-nowrap rounded-full bg-neutral-300 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Contact us to extend your trial ↻
          </a>
          <a
            href="mailto:support@ocf.energy?subject=Subscription%20request"
            className="whitespace-nowrap rounded-full bg-[#FFFBF2] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white"
          >
            Subscribe now →
          </a>
        </div>
        <p className="text-sm text-neutral-400">
          Any questions, as always contact us at{" "}
          <a href="mailto:support@ocf.energy" className="underline hover:text-white">
            support@ocf.energy
          </a>
        </p>
      </div>
    </>
  );
};

export default TrialEndedPopup;
