import { ResponsiveLine } from "@nivo/line";

// make sure parent container have a defined height when using
// responsive component, otherwise height will be 0 and
// no chart will be rendered.
// website examples showcase many properties,
// you'll often use just a few of them.
const MyResponsiveLine = ({
  data,
  sunriseTime = "04:30",
  sunsetTime = "21:30",
  timeOfInterest = "12:00",
}) => (
  <ResponsiveLine
    data={data}
    markers={[
      {
        axis: "x",
        value: sunriseTime,
        lineStyle: { stroke: "#b0413e", strokeWidth: 2 },
        legend: "sunrise",
      },
      {
        axis: "x",
        value: sunsetTime,
        lineStyle: { stroke: "#b0413e", strokeWidth: 2 },
        legend: "sunset",
      },
      {
        axis: "x",
        value: timeOfInterest,
        lineStyle: { stroke: "#b0413e", strokeWidth: 2 },
        legend: "biggest error",
      },
    ]}
    margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
    xScale={{ type: "point" }}
    yScale={{
      type: "linear",
      min: "auto",
      max: "auto",
      stacked: true,
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
    // legends={[
    //   {
    //     anchor: "bottom-right",
    //     direction: "column",
    //     justify: false,
    //     translateX: 100,
    //     translateY: 0,
    //     itemsSpacing: 0,
    //     itemDirection: "left-to-right",
    //     itemWidth: 80,
    //     itemHeight: 20,
    //     itemOpacity: 0.75,
    //     symbolSize: 12,
    //     symbolShape: "circle",
    //     symbolBorderColor: "rgba(0, 0, 0, .5)",
    //     effects: [
    //       {
    //         on: "hover",
    //         style: {
    //           itemBackground: "rgba(0, 0, 0, .03)",
    //           itemOpacity: 1,
    //         },
    //       },
    //     ],
    //   },
    // ]}
  />
);

export default MyResponsiveLine;