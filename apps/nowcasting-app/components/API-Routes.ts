const API_BASE_URL = process.env.NEXT_PUBLIC_API_PREFIX || "";
const IS_FAKE = process.env.NEXT_PUBLIC_IS_FAKE === "1"; // Placeholder for fake data env variable. Please advise on how to implement this?

const paths = {
  allForecasts: `${API_BASE_URL}/v0/solar/GB/gsp/forecast/all/?isFake=${IS_FAKE}`,
  allPVLive: `${API_BASE_URL}/v0/solar/GB/gsp/pvlive/all/?isFake=${IS_FAKE}`,
  forecastByGSPId: (gspId: number) => `${API_BASE_URL}/v0/solar/GB/gsp/${gspId}/forecast/?isFake=${IS_FAKE}`,
  PVLiveByGSPId: (gspId: number) => `${API_BASE_URL}/v0/solar/GB/gsp/${gspId}/pvlive/?isFake=${IS_FAKE}`,
  nationalPVLive: `${API_BASE_URL}/v0/solar/GB/national/pvlive/?isFake=${IS_FAKE}`
};

export { paths, IS_FAKE };