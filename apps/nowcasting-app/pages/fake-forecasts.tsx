import React, { useEffect, useState } from "react";
import ForecastsComponent from "../components/fake-forecast-generation";
import Layout from "../components/layout/layout";
import useGlobalState, { get30MinNow } from '../components/helpers/globalState';
import { AGGREGATION_LEVELS } from "../constant";

export default function ForecastsPage() {
    const [gspId, setGspId] = useState<number | 1>(1);

    // Use global state for necessary views and states
    const [, setView] = useGlobalState("aggregationLevel");
    const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
    const [, setSelectedISOTime] = useGlobalState("selectedISOTime");

    useEffect(() => {
        setView(AGGREGATION_LEVELS.GSP);

        setSelectedISOTime(get30MinNow());

        if (clickedGspId !== undefined && typeof clickedGspId === "number") {
            setClickedGspId(clickedGspId);
        }

        return () => {
            setView(AGGREGATION_LEVELS.GSP);
            
            // Handle National view
            if (clickedGspId == 0) {
              setView(AGGREGATION_LEVELS.NATIONAL);
            }
        };

    }, [setView, setSelectedISOTime, clickedGspId]);

    const handleGspIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const newGspId = value === '' ? 1 : parseInt(value, 10)
        setGspId(newGspId);
        
        setClickedGspId(newGspId);
    };

    return (
   <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Fake Forecasts</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            GSP ID
            <input 
              type="number" 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              value={gspId}
              onChange={handleGspIdChange}
              placeholder="Enter GSP ID (default: 1)"
              min="1"
            />
          </label>
          <p className="text-sm text-gray-500 mt-1">
            Grid Supply Point (GSP) ID for targeted forecast data
          </p>
        </div>
        
        <ForecastsComponent itemId={gspId} />
      </div>
    </Layout>
    );
};