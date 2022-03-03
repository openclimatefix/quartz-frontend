import { NextPage } from "next";
import dynamic from "next/dynamic";
import Layout from "../components/layout";

/**

- Leftmost map of GB from Jack's video ("HRV Satellite & PV")
- As big as possible
 * 
 */

const MyResponsiveLine = dynamic(() => import("../components/charts/line"), {
  ssr: false,
});

const Vis1MapPage: NextPage = () => {
  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex-grow">Map</div>
        <div className="border-t border-black h-60">
          <MyResponsiveLine
            // TODO: replace with pv forecast and actual
            data={[
              {
                id: "pv-forecast",
                color: "black",
                data: [
                  { x: "00:00", y: 22229 },
                  { x: "00:30", y: 22141 },
                  { x: "01:00", y: 21781 },
                  { x: "01:30", y: 21719 },
                  { x: "02:00", y: 21651 },
                  { x: "02:30", y: 21419 },
                  { x: "03:00", y: 21787 },
                  { x: "03:30", y: 21667 },
                  { x: "04:00", y: 21609 },
                  { x: "04:30", y: 21460 },
                  { x: "05:00", y: 22104 },
                  { x: "05:30", y: 24055 },
                  { x: "06:00", y: 26009 },
                  { x: "06:30", y: 28003 },
                  { x: "07:00", y: 28875 },
                  { x: "07:30", y: 29759 },
                  { x: "08:00", y: 29807 },
                  { x: "08:30", y: 30135 },
                  { x: "09:00", y: 30118 },
                  { x: "09:30", y: 29787 },
                  { x: "10:00", y: 30045 },
                  { x: "10:30", y: 29581 },
                  { x: "11:00", y: 29373 },
                  { x: "11:30", y: 29206 },
                  { x: "12:00", y: 29107 },
                  { x: "12:30", y: 28910 },
                  { x: "13:00", y: 28394 },
                  { x: "13:30", y: 28400 },
                  { x: "14:00", y: 28318 },
                  { x: "14:30", y: 28472 },
                  { x: "15:00", y: 29024 },
                  { x: "15:30", y: 29367 },
                  { x: "16:00", y: 29821 },
                  { x: "16:30", y: 30387 },
                  { x: "17:00", y: 30694 },
                  { x: "17:30", y: 30706 },
                  { x: "18:00", y: 30572 },
                  { x: "18:30", y: 30379 },
                  { x: "19:00", y: 30176 },
                  { x: "19:30", y: 29319 },
                  { x: "20:00", y: 29201 },
                  { x: "20:30", y: 28401 },
                  { x: "21:00", y: 27517 },
                  { x: "21:30", y: 26597 },
                  { x: "22:00", y: 25004 },
                  { x: "22:30", y: 23899 },
                ],
              },
            ]}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Vis1MapPage;
