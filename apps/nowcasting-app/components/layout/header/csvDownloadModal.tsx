import React, { useEffect, useMemo, useState } from "react";
import { getNHourForecastLabel } from "../../helpers/csvDownload";
import Toggle from "../../Toggle";
import { CloseButtonIcon } from "../../icons/icons";

export type CSVColumn =
  | "startDateTime"
  | "endDateTime"
  | "settlementPeriod"
  | "solarGenerationPvliveInitial"
  | "solarGenerationPvliveUpdated"
  | "solarForecast"
  | "nForecast"
  | "delta"
  | "pLevels";

const FIXED_COLUMNS: CSVColumn[] = ["startDateTime", "endDateTime"];

const SELECTABLE_COLUMNS: { id: CSVColumn; label: string }[] = [
  { id: "settlementPeriod", label: "Settlement Period" },
  { id: "solarGenerationPvliveInitial", label: "PVLive Initial" },
  { id: "solarGenerationPvliveUpdated", label: "PVLive Updated" },
  { id: "solarForecast", label: "Current Forecast" },
  { id: "pLevels", label: "Forecast P-levels" },
  { id: "nForecast", label: "N Forecast" },
  { id: "delta", label: "Delta" }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (cols: CSVColumn[]) => void;
  nHourForecast: number;
  /** Whether a comparison is active — the delta column only makes sense against a B side. */
  comparisonActive: boolean;
}

export const CSVDownloadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onDownload,
  nHourForecast,
  comparisonActive
}) => {
  const selectableColumns = useMemo(
    () =>
      SELECTABLE_COLUMNS.map((column) =>
        column.id === "nForecast"
          ? { ...column, label: `${getNHourForecastLabel(nHourForecast)}` }
          : column
      ),
    [nHourForecast]
  );

  const availableSelectableColumns = useMemo(
    () => selectableColumns.filter((column) => column.id !== "delta" || comparisonActive),
    [selectableColumns, comparisonActive]
  );

  const allSelectableIds = useMemo(
    () => availableSelectableColumns.map((column) => column.id),
    [availableSelectableColumns]
  );

  const [selected, setSelected] = useState<CSVColumn[]>(allSelectableIds);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(allSelectableIds);
  }, [allSelectableIds, isOpen]);

  const toggle = (id: CSVColumn) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelected((prev) => (prev.length === allSelectableIds.length ? [] : allSelectableIds));

  const download = () => {
    onDownload([...FIXED_COLUMNS, ...selected]);
    onClose();
  };

  if (!isOpen) return null;

  const allSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selected.includes(id));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-surface-inset/40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-[25rem] max-h-[85vh] overflow-y-auto rounded-2xl border border-content/35 bg-[#1d1e20] shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between border-b border-content/35 bg-[#1d1e20] px-4 py-2">
            <h2 className="font-semibold text-content">Select Data for Download</h2>
            <button
              type="button"
              aria-label="Close download modal"
              onClick={onClose}
              className="leading-none text-content opacity-70 hover:opacity-100"
            >
              <CloseButtonIcon />
            </button>
          </div>

          <div className="px-4 py-3">
            {/* Select All row */}
            <div className="mb-1 flex items-center gap-3 py-1.5">
              <div className="-ml-2">
                <Toggle onClick={toggleAll} visible={allSelected} />
              </div>
              <span className="text-sm font-medium text-content/65">Select All</span>
            </div>

            {/* Column rows */}
            {selectableColumns.map((col) => {
              const isDisabled = col.id === "delta" && !comparisonActive;
              return (
                <div key={col.id} className="flex items-center gap-3">
                  <div className="-ml-2">
                    <Toggle
                      onClick={() => !isDisabled && toggle(col.id)}
                      visible={!isDisabled && selected.includes(col.id)}
                    />
                  </div>
                  <span
                    className={`text-sm ${
                      isDisabled ? "font-medium text-content/35" : "font-semibold text-content"
                    }`}
                  >
                    {col.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#1d1e20] p-2">
            <button
              onClick={download}
              disabled={!selected.length}
              className={`h-11 w-full rounded-[10px] text-sm font-semibold tracking-[0.01em] transition-colors ${
                selected.length
                  ? "bg-surface-raised text-content ring-1 ring-inset ring-edge hover:bg-interactive hover:text-content-on-accent"
                  : "bg-surface-raised/40 text-content-muted/50 cursor-not-allowed"
              }`}
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
