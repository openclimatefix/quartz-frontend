import { SolarStatus } from "../types";

interface StatusBannerProps {
  isSitesChart: boolean;
  solarStatus?: SolarStatus;
  sitesStatus?: SolarStatus;
}

const StatusBanner = ({ isSitesChart, solarStatus, sitesStatus }: StatusBannerProps) => {
  let status;

  if (isSitesChart) {
    status = sitesStatus;
  } else {
    status = solarStatus;
  }

  if (!status || status.status === "ok" || status.message === "") {
    return null;
  }

  return (
    <div className="bg-surface-sunken text-content-secondary text-center px-4 py-2">
      <p>⚠️&nbsp;{solarStatus?.message}</p>
    </div>
  );
};

export default StatusBanner;
