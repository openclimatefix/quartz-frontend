import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";

/**
 * This is a secured GET endpoint that requires API authentication.
 * It retrieves the access token for the authenticated user.
 *
 * @async
 * @function GET
 * @param {NextRequest} req - The Next.js API request object.
 * @returns {NextResponse} A JSON response containing the access token.
 */
const GET = withApiAuthRequired(async function GET(req: NextRequest) {
  const res = new NextResponse();
  const { accessToken } = await getAccessToken(req, res);
  return NextResponse.json({ accessToken }, res);
});

export { GET };
