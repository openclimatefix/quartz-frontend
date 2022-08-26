/*
Footer class - need to check if this is used any more # ODO
*/
export default function Footer() {
  return (
    <footer className=" p-4 bg-black h-fit">
      <div className="flex items-center justify-between">
        <a
          className="flex  space-x-6 justify-center "
          target="_blank"
          href="https://nowcasting.io/"
          rel="noreferrer"
        >
          <img src="/NOWCASTING_Secondary-white.svg" alt="ofc" width={200} className="flex	" />
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
