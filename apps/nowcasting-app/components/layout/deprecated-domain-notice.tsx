import React, { useEffect, useState } from "react";

/**
 * The nowcasting.io → app.quartz.solar redirect notice.
 *
 * Host detection runs in an effect rather than at render so the server-rendered markup matches
 * the first client render; on any other host this renders nothing.
 */
const DeprecatedDomainNotice = () => {
  const [isOldNowcastingDomain, setIsOldNowcastingDomain] = useState(false);

  useEffect(() => {
    setIsOldNowcastingDomain(window.location.host.includes("nowcasting.io"));
  }, []);

  if (!isOldNowcastingDomain) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-mapbox-black bg-opacity-75">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-col items-center text-xs text-ocf-gray-500 px-8 py-12 bg-mapbox-black rounded-md">
          <h3 className="text-xl mb-4 font-bold">We have moved.</h3>
          <div className="text-lg mr-1 mb-6">nowcasting.io has now become Quartz Solar.</div>
          <div className="text-lg mr-1 mb-6">
            This URL is deprecated, please move over to the new Quartz domain.
          </div>
          <div>
            <a
              className="text-lg uppercase btn hover:bd-ocf-yellow-500"
              href="https://app.quartz.solar"
            >
              Go to Quartz.solar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeprecatedDomainNotice;
