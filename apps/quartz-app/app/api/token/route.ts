import { NextResponse } from "next/server";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";

const GET = withApiAuthRequired(async function GET(req) {
  const res = new NextResponse();
  const { accessToken } = await getAccessToken(req, res);
  return NextResponse.json({ accessToken }, res);
});

export { GET };
