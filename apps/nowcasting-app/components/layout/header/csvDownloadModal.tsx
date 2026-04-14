import React, { useEffect, useMemo, useState } from "react";
import { getNHourForecastLabel } from "../../helpers/csvDownload";
import { VIEWS } from "../../../constant";

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
  { id: "solarGenerationPvliveInitial", label: "PVLive Initial (MW)" },
  { id: "solarGenerationPvliveUpdated", label: "PVLive Updated (MW)" },
  { id: "solarForecast", label: "Solar Forecast (MW)" },
  { id: "solarForecastP10", label: "Forecast P10 (MW)" },
  { id: "solarForecastP90", label: "Forecast P90 (MW)" },
  { id: "nForecast", label: "N Forecast (MW)" },
  { id: "delta", label: "Delta (MW)" }
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
          ? { ...column, label: `${getNHourForecastLabel(nHourForecast)} (MW)` }
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
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-4">
            <h2 className="text-lg font-semibold">Select Columns to Download</h2>
          </div>

          <div className="p-4 space-y-3">
            <label className="flex items-center gap-3 font-semibold border-b pb-2 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              {allSelected ? "Deselect All" : "Select All"}
            </label>

            {selectableColumns.map((col) => (
              <label
                key={col.id}
                className={`flex items-center gap-3 ${
                  col.id === "delta" && view !== VIEWS.DELTA
                    ? "cursor-not-allowed text-gray-400"
                    : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(col.id)}
                  disabled={col.id === "delta" && view !== VIEWS.DELTA}
                  onChange={() => toggle(col.id)}
                />
                {col.label}
              </label>
            ))}
          </div>

          <div className="sticky bottom-0 border-t p-4 flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100">
              Cancel
            </button>

            <button
              onClick={download}
              disabled={!selected.length}
              className={`flex-1 px-4 py-2 ${
                selected.length ? "bg-ocf-yellow" : "bg-gray-100 cursor-not-allowed"
              }`}
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
