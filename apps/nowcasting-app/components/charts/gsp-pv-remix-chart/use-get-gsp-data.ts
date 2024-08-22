import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastData, GspEntities, PvRealData } from "../../types";
import useGlobalState from "../../helpers/globalState";
import { useLoadDataFromApi } from "../../hooks/useLoadDataFromApi";

const useGetGspData = (gspId: number) => {
  const [show4hView] = useGlobalState("show4hView");
  const [nHourForecast] = useGlobalState("nHourForecast");

  const { data: pvRealDataIn, error: pvRealInDat } = useLoadDataFromApi<PvRealData>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=in-day`
  );

  const { data: pvRealDataAfter, error: pvRealDayAfter } = useLoadDataFromApi<PvRealData>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=day-after`
  );

  //add new useSWR for gspChartData
  const { data: gspForecastDataOneGSP, error: gspForecastDataOneGSPError } =
    useLoadDataFromApi<ForecastData>(`${API_PREFIX}/solar/GB/gsp/${gspId}/forecast`, {
      dedupingInterval: 1000 * 30
    });

  //add new useSWR for gspLocationInfo since this is not
  const { data: gspLocationInfo, error: gspLocationError } = useLoadDataFromApi<GspEntities>(
    `${API_PREFIX}/system/GB/gsp/?gsp_id=${gspId}`
  );

  const { data: gsp4HourData, error: pv4HourError } = useLoadDataFromApi<ForecastData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/gsp/${gspId}/forecast?forecast_horizon_minutes=${
          nHourForecast * 60
        }&historic=true&only_forecast_values=true`
      : null
  );

  return {
    errors: [
      pvRealInDat,
      pvRealDayAfter,
      gspForecastDataOneGSPError,
      gspLocationError,
      pv4HourError
    ].filter((e) => !!e),
    gsp4HourData,
    pvRealDataIn,
    pvRealDataAfter,
    gspForecastDataOneGSP,
    gspLocationInfo
  };
};

export default useGetGspData;
