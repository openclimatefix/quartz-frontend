import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { NextApiRequest, NextApiResponse } from "next";

export default process.env.NEXT_PUBLIC_DEV_MODE === "true"
  ? async function token(req: NextApiRequest, res: NextApiResponse) {
      if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
        const { bearer } = req.cookies;
        return res.status(200).json({ accessToken: bearer || "FAKE_TOKEN" });
      }
    }
  : withApiAuthRequired(async function token(req: NextApiRequest, res: NextApiResponse) {
      if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
        return res.status(200).json({ accessToken: "FAKE_TOKEN" });
      }
      try {
        const accessToken = await getAccessToken(req, res);
        res.status(200).json(accessToken);
      } catch (error: any) {
        res.status(error.status || 400).end(error.message);
      }
    });
