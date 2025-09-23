import { FC } from "react";

export const OcfLogo: FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <a
    id={`${idPrefix}Link`}
    className="max-h-full z-20"
    href="https://www.openclimatefix.org/"
    target="_blank"
    rel="noreferrer"
  >
    <img
      id={`${idPrefix}Img`}
      src="/OCF_icon_wht.svg"
      alt="Open Climate Fix logo"
      title="Open Climate Fix logo"
      width={40}
    />
  </a>
);
