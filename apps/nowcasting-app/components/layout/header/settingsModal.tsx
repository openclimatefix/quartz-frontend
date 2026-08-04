import React from "react";
import { P_LEVEL_OPTIONS } from "../../../constant";
import useGlobalState from "../../helpers/globalState";
import { CookieStorageKeys, setArraySettingInCookieStorage } from "../../helpers/cookieStorage";
import Toggle from "../../Toggle";
import { CloseButtonIcon } from "../../icons/icons";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [pLevels, setPLevels] = useGlobalState("pLevels");

  const toggle = (pair: [number, number]) => {
    const next = pLevels.some(([lower]) => lower === pair[0])
      ? pLevels.filter(([lower]) => lower !== pair[0])
      : [...pLevels, pair];
    setPLevels(next);
    setArraySettingInCookieStorage(CookieStorageKeys.P_LEVELS, next);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-[25rem] rounded-2xl border border-white/35 bg-[#1d1e20] shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/35 px-4 py-2">
            <h2 className="font-semibold text-white">Settings</h2>
            <button
              type="button"
              aria-label="Close settings modal"
              onClick={onClose}
              className="leading-none opacity-70 hover:opacity-100"
            >
              <CloseButtonIcon />
            </button>
          </div>

          <div className="px-4 py-3">
            <h3 className="mb-2 text-sm text-left font-semibold text-white/70">P-levels</h3>
            {P_LEVEL_OPTIONS.map(([lower, upper]) => (
              <div key={lower} className="flex items-center gap-3">
                <div className="-ml-2">
                  <Toggle
                    onClick={() => toggle([lower, upper])}
                    visible={pLevels.some(([l]) => l === lower)}
                  />
                </div>
                <span className="text-sm font-semibold text-white">{`P${lower} / P${upper}`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
