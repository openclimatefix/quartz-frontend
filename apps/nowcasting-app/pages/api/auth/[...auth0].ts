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
          // If the user has just come from the auth/denied page, we can assume they have not
          // verified their email, so we amend the message
          query.error_description =
            "Email not verified. Please check your inbox and verify your email address before continuing.";
          // If the user denied access, redirect to a holding page
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
