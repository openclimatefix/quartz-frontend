import { getAccessToken, getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { NextApiRequest, NextApiResponse } from "next";

export default process.env.NEXT_PUBLIC_DEV_MODE === "true"
  ? async function token(req: NextApiRequest, res: NextApiResponse) {
      if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
        return res.status(200).json({ accessToken: "FAKE_TOKEN" });
      }
      try {
        const accessToken = await getAccessToken(req, res);
        res.status(200).json(accessToken);
      } catch (error: any) {
        res.status(error.status || 400).end(error.message);
      }
    }
  : withApiAuthRequired(async function token(req: NextApiRequest, res: NextApiResponse) {
      if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
        return res.status(200).json({ accessToken: "FAKE_TOKEN" });
      }
      try {
        const accessToken = await getAccessToken(req, res);
        const session = await getSession(req, res);
        const trialEndsAt = session?.user?.trial_ends_at;
        const trialExpired = !!trialEndsAt && new Date(trialEndsAt) < new Date();
        res.status(200).json({ ...accessToken, trialExpired });
      } catch (error: any) {
        if (error.message?.includes("access_denied")) {
          return res.status(403).json({ error: "access_denied", message: error.message });
        }
        res.status(error.status || 400).end(error.message);
      }
    });
