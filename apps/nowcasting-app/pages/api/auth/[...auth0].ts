import { handleAuth, handleLogout } from "@auth0/nextjs-auth0";
import { withSentry } from "@sentry/nextjs";

export default withSentry(
  handleAuth({
    async logout(req, res) {
      await handleLogout(req, res, {
        returnTo: "/logout",
      });
    },
  }),
);
