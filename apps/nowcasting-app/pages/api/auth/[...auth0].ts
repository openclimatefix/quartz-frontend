import { handleAuth, handleLogout } from "@auth0/nextjs-auth0";

export default handleAuth({
  async logout(req, res) {
    await handleLogout(req, res, {
      returnTo: "/logout",
    });
  },
});
