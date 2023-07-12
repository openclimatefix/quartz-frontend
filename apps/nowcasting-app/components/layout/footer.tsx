export default function Footer() {
  return (
    <footer className=" p-4 bg-black h-fit">
      <div className="flex items-center justify-between">
        <a
          className="flex  space-x-6 justify-center "
          target="_blank"
          href="https://quartz.solar/"
          rel="noreferrer"
        >
          <img src="/QUARTZSOLAR_LOGO_SECONDARY_WHITE.svg" alt="ofc" width={200} className="flex	" />
        </a>
        <a
          href="https://www.openclimatefix.org/"
          target="_blank"
          className="flex  ml-4 space-x-6 justify-center"
          rel="noreferrer"
        >
          <img src="/OCF_icon_wht.svg" alt="ofc" width={100} />
        </a>
      </div>
    </footer>
  );
}
