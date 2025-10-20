import { handleAuth, handleCallback, handleLogin, handleLogout } from "@auth0/nextjs-auth0";
import { wrapApiHandlerWithSentry, setUser } from "@sentry/nextjs";
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

export default wrapApiHandlerWithSentry(
  handleAuth({
    async callback(req: NextApiRequest, res: NextApiResponse) {
      try {
        const { redirectUri } = getUrls(req);
        const { query } = req;
        if (query.error?.includes("access_denied")) {
          // If trial has expired, redirect to Trial Expired page
          console.log("query.error_description?.toString()", query.error_description?.toString());
          if (query.error_description?.includes("trial period")) {
            res.redirect(
              `/expired?email=${query.error_description?.toString().split("user_email:")[1]}`
            );
          }
          res.redirect(
            `/auth/denied?${new URLSearchParams(query as Record<string, string>).toString()}`
          );
        }
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
            audience: process.env.NEXT_PUBLIC_AUTH0_API_AUDIENCE || "https://api.nowcasting.io/", // Production fallback
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
      setUser(null);
      const returnTo = req.query.redirectToLogin ? "/api/auth/login" : "/logout";
      await handleLogout(req, res, {
        returnTo
      });
    }
  }),
  "/api/*"
);
