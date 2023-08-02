import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastData, PvRealData } from "../../types";
import useGlobalState from "../../helpers/globalState";
import { useLoadDataFromApi } from "../../hooks/useLoadDataFromApi";

const useGetGspData = (gspId: number) => {
  const [show4hView] = useGlobalState("show4hView");
  const { data: fcAll, error: fcAllError } = useLoadDataFromApi<FcAllResData>(
    getAllForecastUrl(true, true)
  );

  const { data: pvRealDataIn, error: pvRealInDat } = useLoadDataFromApi<PvRealData>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=in-day`
  );

  const { data: pvRealDataAfter, error: pvRealDayAfter } = useLoadDataFromApi<PvRealData>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=day-after`
  );

  const { data: gsp4HourData, error: pv4HourError } = useLoadDataFromApi<ForecastData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/gsp/forecast/${gspId}?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
      : null
  );

  return {
    errors: [fcAllError, pvRealInDat, pvRealDayAfter, pv4HourError].filter((e) => !!e),
    fcAll,
    gsp4HourData,
    pvRealDataIn,
    pvRealDataAfter
  };
};

export default useGetGspData;
