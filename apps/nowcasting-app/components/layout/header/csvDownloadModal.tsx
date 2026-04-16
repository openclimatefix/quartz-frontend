import React, { useEffect, useMemo, useState } from "react";
import { getNHourForecastLabel } from "../../helpers/csvDownload";
import { VIEWS } from "../../../constant";
import Toggle from "../../Toggle";
import { CloseButtonIcon } from "../../icons/icons";

export type CSVColumn =
  | "startDateTime"
  | "endDateTime"
  | "settlementPeriod"
  | "solarGenerationPvliveInitial"
  | "solarGenerationPvliveUpdated"
  | "solarForecast"
  | "solarForecastP10"
  | "solarForecastP90"
  | "nForecast"
  | "delta";

const FIXED_COLUMNS: CSVColumn[] = ["startDateTime", "endDateTime"];

const SELECTABLE_COLUMNS: { id: CSVColumn; label: string }[] = [
  { id: "settlementPeriod", label: "Settlement Period" },
  { id: "solarGenerationPvliveInitial", label: "PVLive Initial" },
  { id: "solarGenerationPvliveUpdated", label: "PVLive Updated" },
  { id: "solarForecast", label: "Current Forecast" },
  { id: "solarForecastP10", label: "Forecast P10" },
  { id: "solarForecastP90", label: "Forecast P90" },
  { id: "nForecast", label: "N Forecast" },
  { id: "delta", label: "Delta" }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (cols: CSVColumn[]) => void;
  nHourForecast: number;
  view: VIEWS;
}

export const CSVDownloadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onDownload,
  nHourForecast,
  view
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
    () => selectableColumns.filter((column) => column.id !== "delta" || view === VIEWS.DELTA),
    [selectableColumns, view]
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
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-[30rem] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/35 bg-[#1d1e20] shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between border-b border-white/35 bg-[#1d1e20] px-4 py-3">
            <h2 className="font-semibold text-white">Select Data for Download</h2>
            <button
              type="button"
              aria-label="Close download modal"
              onClick={onClose}
              className="leading-none opacity-70 hover:opacity-100"
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
              <span className="text-sm font-medium text-white/65">Select All</span>
            </div>

            {/* Column rows */}
            {selectableColumns.map((col) => {
              const isDisabled = col.id === "delta" && view !== VIEWS.DELTA;
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
                      isDisabled ? "font-medium text-white/35" : "font-semibold text-white"
                    }`}
                  >
                    {col.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#1d1e20] px-4 pb-4 pt-2">
            <button
              onClick={download}
              disabled={!selected.length}
              className={`h-11 w-full rounded-[10px] text-sm font-semibold tracking-[0.01em] transition-colors ${
                selected.length
                  ? "bg-ocf-yellow text-black hover:brightness-95"
                  : "bg-ocf-yellow/30 text-black/40 cursor-not-allowed"
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
