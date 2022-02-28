import { NextApiResponse } from "next";
import { register, collectDefaultMetrics } from "prom-client";

collectDefaultMetrics({});

export default async (_, res: NextApiResponse) => {
  res.setHeader("Content-type", register.contentType);
  res.send(await register.metrics());
};
