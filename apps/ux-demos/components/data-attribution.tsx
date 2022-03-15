interface IDataAttribution {
  datasets: {
    title: string;
    sourceName: string;
    sourceUrl?: string;
    displayedWhere: string;
    isPublic: boolean;
  }[];
}

import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XIcon } from "@heroicons/react/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/outline";

const DataAttribution = ({ datasets = [] }: IDataAttribution) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fixed z-10 inline-flex items-center p-2 text-white border border-transparent rounded-full shadow-sm hover:text-black top-2 right-2 hover:bg-white"
        onClick={() => setOpen(true)}
      >
        <QuestionMarkCircleIcon className="w-6 h-6" aria-hidden="true" />
      </button>

      <Transition.Root show={open} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-20 overflow-hidden"
          onClose={() => setOpen(false)}
        >
          <div className="absolute inset-0 overflow-hidden">
            <Dialog.Overlay className="absolute inset-0" />

            <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <div className="w-screen max-w-md pointer-events-auto">
                  <div className="flex flex-col h-full py-6 overflow-y-scroll bg-white shadow-xl">
                    <div className="px-4 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-2xl text-gray-900">
                          Data Sources
                        </Dialog.Title>
                        <div className="flex items-center ml-3 h-7">
                          <button
                            type="button"
                            className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            onClick={() => setOpen(false)}
                          >
                            <span className="sr-only">Close panel</span>
                            <XIcon className="w-6 h-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative flex-1 px-4 mt-6 sm:px-6">
                      <div className="absolute inset-0 px-4 sm:px-6">
                        {datasets.map(
                          ({ title, sourceName, sourceUrl, isPublic }, i) => (
                            <div className="mb-6" key={title}>
                              <h2 className="text-lg">
                                Dataset #{i + 1}: {title}
                              </h2>
                              <p>Provider: {sourceName}</p>
                              {isPublic && (
                                <p>
                                  <a
                                    href={sourceUrl}
                                    className="text-indigo-800 underline"
                                  >
                                    Get Data
                                  </a>
                                </p>
                              )}
                              <span
                                className={`inline-flex items-center px-2 py-0.5 my-2 rounded text-xs font-medium ${
                                  isPublic
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {isPublic ? "PUBLIC" : "PRIVATE"}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};

export default DataAttribution;
