import React from "react";
import { FC } from "react";
import { PvRealData, ForecastData } from "../../types";
import { UpArrow, DownArrow } from "../../icons/delta";

const DeltaViewMainComponent: FC<{
	date?: string | undefined;
	className?: string | undefined;
}> = ({}) => {
	return (
		<div className="flex justify-between align-center bg-ocf-gray-800 h-auto">
			<div className="ml-5 py-3 text-ocf-black font-bold">National</div>
			<div className="flex justify-between flex-2 my-2 px-6">
				<div className="flex-col uppercase">
					<div className="text-xs">Latest Forecast</div>
					<div>GW</div>
				</div>
				<div className="flex-col uppercase">
					<div className="text-xs">Last 4h Forecast</div>
					<div>GW</div>
				</div>
			</div>
			<div className="bg-ocf-delta px-10 pr-2 uppercase">
				<p>Delta</p>
				<div className="flex">
					<DownArrow />
					<p>GW</p>
				</div>
			</div>
		</div>
	);
};

//import some data
//make fake delta

// component for delta view national header
// component for national delta chart
// component for gsp delta chart
// component for tables + button panel
// component for legend

export default DeltaViewMainComponent;
