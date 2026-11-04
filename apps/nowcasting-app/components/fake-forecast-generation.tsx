import React, { useEffect, useState } from "react";
import { IS_FAKE } from "./API-Routes";
import { fetchAllForecasts, 
  fetchforecastByGSPID, 
  fetchallPVLive, 
  fetchPVLive, 
  nationalPVLive 
} from "./fake-API-calls";
import Tooltip from "./tooltip";
import Toggle from "./Toggle";
import ButtonGroup from "./button-group";

// Define available route keys
type RouteKey = 
  | "allForecasts" 
  | "forecastByGspId" 
  | "allPVLive" 
  | "PVLiveByGspId" 
  | "nationalPVLive";

interface GSPIds {
  itemId?: number; 
}

const ForecastsComponent: React.FC<GSPIds> = ({ itemId }) => {
  const [selectedRoutes, setSelectedRoutes] = useState<RouteKey[]>(["allForecasts"]); // Set default route to 'allForecasts'
  const [results, setResults] = useState<Array<{ route: RouteKey; data: any }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadForecasts = async () => {
      setIsLoading(true);
      try {
        // Map selected routes to their corresponding FastAPI calls
        const promises = selectedRoutes.map(async (route) => {
          try {
            let data;
            switch (route) {
              case "allForecasts":
                data = await fetchAllForecasts();
                break;
              case "forecastByGspId":
                if (!itemId && !IS_FAKE) throw new Error("Please enter GSP ID for this route");
                data = await fetchforecastByGSPID(itemId || 1);
                break;
              case "allPVLive":
                data = await fetchallPVLive();
                break;
              case "PVLiveByGspId":
                if (!itemId && !IS_FAKE) throw new Error("Please enter GSP ID for this route");
                data = await fetchPVLive(itemId || 1);
                break;
              case "nationalPVLive":
                data = await nationalPVLive();
                break;
              default:
                throw new Error(`Unknown route: ${route}`);
          }
          return { route, data };
        } catch (error) {
          if (IS_FAKE) {
            return { route, data: { fake: true, data: [] } };
          }
          throw error;
        }
      });

        // Wait for all requests to complete
        const results = await Promise.all(promises);
        setResults(results);
        setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

    loadForecasts();
  }, [setSelectedRoutes, setResults, setError, setIsLoading, itemId]);

  const toggleRoute = (route: RouteKey) => {
    setSelectedRoutes(prev =>
      prev.includes(route)
        ? prev.filter(r => r !== route)
        : [...prev, route]
    );
  };

  // Define Route Configuration
  const routeConfig: Array<{ key: RouteKey; label: string; tip: string }> = [
    { key: "allForecasts", label: "All available forecasts", tip: "Fetch all available forecasts" },
    { key: "forecastByGspId", label: "Forecast by GSP ID", tip: "Fetch forecast by GSP ID" },
    { key: "allPVLive", label: "All PV Live", tip: "Fetch all PV live data" },
    { key: "PVLiveByGspId", label: "PV Live by GSP ID", tip: "Fetch PV live data by GSP ID" },
    { key: "nationalPVLive", label: "National PV Live", tip: "Fetch national PV live data" }
  ];

  return (
    <div>      
      {IS_FAKE && (
        <div className="bg-yellow-100 p-2 mb-4 rounded">
          Running in Fake Data Mode
        </div>
      )}

      <div className="mb-4">
        {routeConfig.map(({ key, label, tip }) => (
          <Tooltip key={key} tip={tip} position="top">
            <Toggle
              onClick={() => toggleRoute(key)}
              visible={selectedRoutes.includes(key)}
            />
            <span>{label}</span>
          </Tooltip>
        ))}
      </div>

      {isLoading && <div>Loading Fake Forecasts...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <pre>{JSON.stringify(results, null, 2)}</pre>

      <ButtonGroup rightString="Forecast Data" />
    </div>
  );
};

export default ForecastsComponent;