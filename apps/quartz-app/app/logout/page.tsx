"use client";

import { useRouter } from "next/navigation";
import { ChevronRightIcon } from "@heroicons/react/solid";
import { SupportIcon, ViewListIcon } from "@heroicons/react/outline";

const MyPage = () => {
  const router = useRouter();
  const links = [
    // {
    //   title: "Documentation",
    //   description: "Learn how to integrate our tools with your app",
    //   icon: BookOpenIcon,
    //   url: "https://openclimatefix.notion.site/Quartz-Solar-Documentation-0d718915650e4f098470d695aa3494bf",
    // },
    {
      title: "API Reference",
      description: "A complete API reference for our library",
      icon: ViewListIcon,
      url: process.env.NEXT_PUBLIC_API_URL + "docs" || "https://api.quartz.energy/docs"
    },
    {
      title: "Support",
      description: "Get help with any problems you encounter",
      icon: SupportIcon,
      url: "mailto:quartz.support@openclimatefix.org?subject=Quartz%20Energy%20Support%20Request"
    }
  ];
  return (
    <div className="container flex-1 flex flex-col gap-6 py-24 items-center">
      <div className="flex-1 flex flex-col gap-6 justify-center text-center md:text-left items-center">
        <h1 className="text-4xl text-white">See you next time.</h1>
        <h2 className="text-xl text-white px-3">You have been successfully logged out.</h2>
        <button
          className="bg-ocf-yellow py-2 px-3 rounded-md"
          onClick={() => router.push("/api/auth/login")}
        >
          Log back in &rarr;
        </button>
      </div>
      <div className="max-w-3xl w-full flex flex-1 flex-col gap-6 justify-center items-center">
        <div className="mt-16">
          <h2 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
            More from Quartz
          </h2>
          <ul
            role="list"
            className="mt-4 border-t border-b border-gray-200 divide-y divide-gray-200"
          >
            {links.map((link, linkIdx) => (
              <li key={`LogoutLink${linkIdx}`} className="relative flex items-start py-6 space-x-4">
                <div className="flex-shrink-0">
                  <span className="flex items-center justify-center w-12 h-12 rounded-lg">
                    <link.icon className="w-6 h-6 text-gray-300" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-gray-100">
                    <span className="rounded-sm focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-gray-500">
                      <a href={link.url} className="focus:outline-none">
                        <span className="absolute inset-0" aria-hidden="true" />
                        {link.title}
                      </a>
                    </span>
                  </h3>
                  <p className="text-base text-gray-400">{link.description}</p>
                </div>
                <div className="self-center flex-shrink-0">
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MyPage;
