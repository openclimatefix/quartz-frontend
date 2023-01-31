import { handleAuth, handleCallback, handleLogin, handleLogout } from "@auth0/nextjs-auth0";
import { withSentry } from "@sentry/nextjs";
import { NextApiRequest, NextApiResponse } from "next";

function getUrls(req: NextApiRequest) {
  const host = req.headers["host"];
  const protocol = process.env.VERCEL_URL ? "https" : "http";
  const redirectUri = `${protocol}://${host}/api/auth/callback`;
  const returnTo = `${protocol}://${host}`;
  return {
    redirectUri,
    returnTo
  };
}

export default withSentry(
  handleAuth({
    async callback(req: NextApiRequest, res: NextApiResponse) {
      try {
        const { redirectUri } = getUrls(req);
        await handleCallback(req, res, { redirectUri: redirectUri });
      } catch (error: any) {
        res.status(error.status || 500).end(error.message);
      }
    },

    async login(req: NextApiRequest, res: NextApiResponse) {
      try {
        const { redirectUri, returnTo } = getUrls(req);

        await handleLogin(req, res, {
          authorizationParams: {
            redirect_uri: redirectUri,
            audience: process.env.NEXT_PUBLIC_AUTH0_API_AUDIENCE || "https://api.nowcasting.io/",
            scope: "openid profile email offline_access",
            useRefreshTokens: true
          },
          returnTo: returnTo
        });
      } catch (error: any) {
        res.status(error.status || 400).end(error.message);
      }
    },

    async logout(req: NextApiRequest, res: NextApiResponse) {
      const returnTo = req.query.redirectToLogin ? "/api/auth/login" : "/logout";
      await handleLogout(req, res, {
        returnTo
      });
    }
  })
);
