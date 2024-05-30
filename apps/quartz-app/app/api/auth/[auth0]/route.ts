import { handleAuth, handleLogout, HandleAuth } from "@auth0/nextjs-auth0";

/**
 * This is a GET endpoint that automatically handles authentication using Auth0.
 * We're using a logout option override to redirect to "/logout" after logout.
 *
 * @function GET
 * @returns {HandleAuth} A function that handles authentication.
 */
export const GET = handleAuth({
  logout: handleLogout({
    returnTo: "/logout",
  }),
});
