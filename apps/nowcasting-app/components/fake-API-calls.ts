import { paths, IS_FAKE } from "./API-Routes"

const FakeResponsehandler = async (response: Response) => {
    if (!response.ok) {
        if (IS_FAKE) {
            return { fake : true, data: [] }; // Return empty array if no fake data returned
        }
        throw new Error(`HTTP Error status code: ${response.status}`);
    }
    return response.json();
};

// Fetch all forecasts
const fetchAllForecasts = async () => {
    const response = await fetch(paths.allForecasts);
    return FakeResponsehandler(response);
};

// Fetch forecasts by GSP ID
const fetchforecastByGSPID = async (gspId: number) => {
    const response = await fetch(paths.forecastByGSPId(gspId));
    return FakeResponsehandler(response);
};

// Fetch all PVLive forecasts
const fetchallPVLive = async () => {
    const response = await fetch(paths.allPVLive);
    return FakeResponsehandler(response);
};

// Fetch PVLive by GSP ID
const fetchPVLive = async (gspId: number) => {
    const response = await fetch(paths.PVLiveByGSPId(gspId));
    return FakeResponsehandler(response);
};

// Fetch fake PVLive National forecasts
const nationalPVLive = async () => {
    const response = await fetch(paths.nationalPVLive);
    return FakeResponsehandler(response);
};

export {
    fetchAllForecasts,
    fetchforecastByGSPID,
    fetchallPVLive,
    fetchPVLive,
    nationalPVLive
};