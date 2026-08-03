"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { FC, ReactNode, useEffect, useState } from "react";
import Header from "@/src/components/layout/Header";
import Providers from "@/app/providers";
import { Spinner } from "@/src/components/icons/icons";
import * as Sentry from "@sentry/nextjs";

const LayoutWrapper: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { user, isLoading } = useUser();
  const [sentryUserSet, setSentryUserSet] = useState(false);

  useEffect(() => {
    if (user && !sentryUserSet) {
      Sentry.setUser({
        id: user.sub || "",
        email: user.email || "",
        username: user.nickname || "",
        name: user.name,
        locale: user.locale,
        avatar: user.picture
      });
      setSentryUserSet(true);
    }
  }, [user, sentryUserSet]);

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
