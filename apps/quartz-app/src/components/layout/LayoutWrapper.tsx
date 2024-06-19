"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { FC, ReactNode } from "react";
import Header from "@/src/components/layout/Header";
import Providers from "@/app/providers";
import { Spinner } from "@/src/components/icons/icons";

const LayoutWrapper: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-1 bg-ocf-black">
        <Spinner className="w-10 h-10 fill-ocf-yellow text-ocf-grey-700">
          <span className="sr-only">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Providers>
      <Header />
      <main className="flex min-h-screen bg-ocf-black flex-row items-stretch justify-between pt-16">
        {children}
      </main>
    </Providers>
  );
};

export default LayoutWrapper;
