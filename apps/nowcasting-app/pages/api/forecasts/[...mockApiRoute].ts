import type { NextApiRequest, NextApiResponse } from "next";
import { withSentry } from "@sentry/nextjs";

import gbPvGSPJson from "../../../data/dummy-res/fc-gsp.json";
import gspRegions from "../../../data/dummy-res/gsp-regions.json";

function handler(req: NextApiRequest, res: NextApiResponse) {
  const { mockApiRoute } = req.query;

  if ((mockApiRoute as string[]).join("/") === "GB/pv/gsp") {
    res.status(200).json(gbPvGSPJson);
  } else if ((mockApiRoute as string[]).join("/") === "GB/gsp-regions") {
    res.status(200).json(gspRegions);
  } else {
    res.status(400).json({ type: "error", message: "Bad request" });
  }
}

export default withSentry(handler);
