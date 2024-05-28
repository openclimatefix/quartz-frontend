import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import { Main } from "@/src/components/Main";

export default withPageAuthRequired(
  async function Home() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // With SSR, we usually want to set some default staleTime
          // above 0 to avoid refetching immediately on the client
          staleTime: 60 * 1000,
          refetchInterval: 60 * 1000,
        },
      },
    });

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Main />
      </HydrationBoundary>
    );
  },
  { returnTo: "/" }
);
