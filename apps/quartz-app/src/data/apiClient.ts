import createClient from "openapi-fetch";
import { paths } from "@/src/types/schema";

const client = createClient<paths>({
  baseUrl:
    "http://india-development-india-api.ap-south-1.elasticbeanstalk.com/",
  // "http://localhost:8000/",
  // headers: {
  //   Authorization: `Bearer ${process.env.API_KEY}`,
  // },
});

export default client;
