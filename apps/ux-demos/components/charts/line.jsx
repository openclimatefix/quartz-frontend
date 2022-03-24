import { ResponsiveLine } from "@nivo/line";

const setDatasetValsToZeroAfterTOI = (dataset, timeSteps, timeOfInterest) => {
  const toiIndex = timeSteps.indexOf(timeOfInterest);

  return {
    ...dataset,
    data: dataset.data.map(({ x, y }) => {
      if (timeSteps.indexOf(x) > toiIndex) {
        return { x, y: 0 };
      }
      return { x, y };
    }),
  };
};

const MyResponsiveLine = ({
  data,
  timeSteps = [],
  hideAfterTOI = false,
  sunriseTime = "04:30",
  sunsetTime = "21:30",
  timeOfInterest = "12:00",
}) => {
  if (hideAfterTOI) {
    // We need to set every value after `timeOfInterest` to 0
    data = [
      setDatasetValsToZeroAfterTOI(data[0], timeSteps, timeOfInterest),
      setDatasetValsToZeroAfterTOI(data[1], timeSteps, timeOfInterest),
    ];
  }

  return (
    <ResponsiveLine
      data={data}
      markers={[
        {
          axis: "x",
          value: sunriseTime,
          lineStyle: { stroke: "#b0413e", strokeWidth: 2 },
          legend: "sunrise",
          textStyle: { fill: "#b0413e" },
        },
        {
          axis: "x",
          value: sunsetTime,
          lineStyle: { stroke: "#b0413e", strokeWidth: 2 },
          legend: "sunset",
          textStyle: { fill: "#b0413e" },
        },
        {
          axis: "x",
          value: timeOfInterest,
          lineStyle: { stroke: "#b0413e", strokeWidth: 6 },
          legend: "Time",
          textStyle: { fill: "#b0413e" },
        },
      ]}
      margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
      xScale={{ type: "point" }}
      yScale={{
        type: "linear",
        min: "auto",
        max: "auto",
        stacked: false,
        reverse: false,
      }}
      yFormat=" >-.2f"
      axisTop={null}
      axisRight={null}
      // axisBottom={null}
      // axisLeft={null}
      axisBottom={{
        orient: "bottom",
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        // legend: "transportation",
        // legendOffset: 36,
        // legendPosition: "middle",
      }}
      axisLeft={{
        orient: "left",
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        // legend: "count",
        // legendOffset: -40,
        // legendPosition: "middle",
      }}
      // lineWidth={8}
      pointSize={8}
      pointColor={{ theme: "background" }}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      pointLabelYOffset={-12}
      useMesh={true}
      theme={{
        fontSize: 12,
        legends: {
          text: {
            fontSize: 16,
          },
        },
        background: "#191a1a",
        textColor: "white",
      }}
      enableGridX={false}
      enableGridY={false}
      legends={[
        {
          anchor: "top-left",
          direction: "column",
          justify: false,
          translateX: 10,
          translateY: 0,
          itemsSpacing: 0,
          itemDirection: "left-to-right",
          itemWidth: 80,
          itemHeight: 28,
          itemOpacity: 0.75,
          symbolSize: 18,
          symbolShape: "circle",
          symbolBorderColor: "rgba(0, 0, 0, .5)",
          effects: [
            {
              on: "hover",
              style: {
                itemBackground: "rgba(0, 0, 0, .03)",
                itemOpacity: 1,
              },
            },
          ],
        },
      ]}
    />
  );
};

export default MyResponsiveLine;
