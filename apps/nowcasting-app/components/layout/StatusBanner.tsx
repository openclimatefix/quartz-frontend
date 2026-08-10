import { VIEWS } from "../../constant";
import { SolarStatus } from "../types";

interface StatusBannerProps {
  view: VIEWS;
  solarStatus?: SolarStatus;
  sitesStatus?: SolarStatus;
}

const StatusBanner = ({ view, solarStatus, sitesStatus }: StatusBannerProps) => {
  let status;

  if (view === VIEWS.SOLAR_SITES) {
    status = sitesStatus;
  } else {
    status = solarStatus;
  }

  const message = status?.message?.trim();

  if (!message) {
    return null;
  }

  let emoji = "ℹ️";
  switch (status?.status?.trim().toLowerCase()) {
    case "warning":
      emoji = "⚠️";
      break;
    case "error":
      emoji = "🚨";
      break;
  }

  return (
    <div className="bg-mapbox-black text-ocf-gray-600 text-center px-4 py-2">
      <p>
        {emoji}&nbsp;{message}
      </p>
    </div>
  );
};

export default StatusBanner;
