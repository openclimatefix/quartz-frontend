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

  if (!status || status.status === "ok" || status.message === "") {
    return null;
  }

  return (
    <div className="text-white text-m px-4 py-2" style={{ backgroundColor: "#48B0DF" }}>
      <p>{status.message}</p>
    </div>
  );
};

export default StatusBanner;
