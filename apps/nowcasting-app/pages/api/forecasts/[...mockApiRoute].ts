import type { NextApiRequest, NextApiResponse } from "next";
import { withSentry } from "@sentry/nextjs";

import gbPvGSPJson from "../../../data/dummy-res/fc-gsp.json";
import gspRegions from "../../../data/dummy-res/gsp-regions.json";
import forecastNat from "../../../data/dummy-res/forecast-national.json";
import truthAllDayIn from "../../../data/dummy-res/truth-all-day-in.json";
import truthAllDayAfter from "../../../data/dummy-res/truth-all-day-after.json";
import gspDayIn from "../../../data/dummy-res/gsp-day-in.json";
import gspDayAfter from "../../../data/dummy-res/gsp-day-after.json";
import fc_0 from "../../../data/dummy-res/fc-latest-0.json";
import fc_all from "../../../data/dummy-res/fc-all.json";
import solar_status from "../../../data/dummy-res/solar-status.json";

function handler(req: NextApiRequest, res: NextApiResponse) {
  const { mockApiRoute } = req.query;

  if ((mockApiRoute as string[]).join("/") === "GB/pv/gsp") {
    res.status(200).json(gbPvGSPJson);
  } else if ((mockApiRoute as string[]).join("/") === "GB/pv/gsp_boundaries") {
    res.status(200).json(gspRegions);
  } else if ((mockApiRoute as string[]).join("/") === "GB/solar/gsp/forecast/national") {
    res.status(200).json(forecastNat);
  } else if ((mockApiRoute as string[]).join("/") === "GB/solar/gsp/pvlive/one_gsp/0") {
    if (req.query.regime === "in-day") {
      res.status(200).json(truthAllDayIn);
    } else res.status(200).json(truthAllDayAfter);
  } else if ((mockApiRoute as string[]).join("/").match(/GB\/solar\/gsp\/pvlive\/one_gsp\/\d+/)) {
    if (req.query.regime === "in-day") {
      res.status(200).json(gspDayIn);
    } else res.status(200).json(gspDayAfter);
  } else if ((mockApiRoute as string[]).join("/") === "GB/solar/gsp/forecast/latest/0") {
    res.status(200).json(fc_0);
  } else if ((mockApiRoute as string[]).join("/") === "GB/solar/gsp/forecast/all") {
    res.status(200).json(fc_all);
  } else if ((mockApiRoute as string[]).join("/") === "GB/solar/status") {
    res.status(200).json(solar_status);
  } else {
    res.status(400).json({ type: "error", message: "Bad request" });
  }
}

export default withSentry(handler);
