import { useRef } from "react";
import * as d3 from "d3";

import { getForecastAccessorForTimeHorizon, useChartDimensions } from "./utils";

interface IChart {
  data: any;
  selectedTimeHorizon: number;
}

// const ChartContext = createContext();
// export const useDimensionsContext = () => useContext(ChartContext);

const Chart = ({ data, selectedTimeHorizon }: IChart) => {
  const gspAccessor = (d) => d.location.gspId;
  const forecastAccessor =
    getForecastAccessorForTimeHorizon(selectedTimeHorizon);

  const [ref, dms] = useChartDimensions({});

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(data, gspAccessor))
    .range([0, dms.boundedWidth]);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(data, forecastAccessor))
    .range([dms.boundedHeight, 0])
    .nice();

  const xAccessorScaled = (d) => xScale(gspAccessor(d));
  const yAccessorScaled = (d) => yScale(forecastAccessor(d));

  const lineGenerator = d3["line"]()
    .x(xAccessorScaled)
    .y(yAccessorScaled)
    .curve(d3.curveMonotoneX);

  const line = lineGenerator(data);

  const xAxisRef = useRef();
  if (xAxisRef.current) {
    d3.select(xAxisRef.current)
      .transition()
      .call(d3.axisBottom().scale(xScale));
  }

  const yAxisRef = useRef();
  if (yAxisRef.current) {
    d3.select(yAxisRef.current).transition().call(d3.axisLeft().scale(yScale));
  }

  return (
    <div ref={ref} className="w-full h-full">
      {/* <ChartContext.Provider value={dms}> */}
      <svg width={dms.width} height={dms.height}>
        <g transform={`translate(${dms.marginLeft}, ${dms.marginTop})`}>
          <path fill="none" stroke="#468AC9" strokeWidth="2" d={line} />
          <g
            className="xAxis"
            ref={xAxisRef}
            transform={`translate(0, ${dms.boundedHeight})`}
          />
          <g className="yAxis" ref={yAxisRef} />
        </g>
      </svg>
      {/* </ChartContext.Provider> */}
    </div>
  );
};

export default Chart;