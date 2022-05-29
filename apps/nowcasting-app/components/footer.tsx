export default function Footer() {
  return (
    <footer className=" p-4 bg-black h-fit">
      <div className="flex items-center justify-between">
        <a className="flex  space-x-6 justify-center " href="https://nowcasting.io/">
          <img src="/NOWCASTING_Secondary-white.svg" alt="ofc" width={200} className="flex	" />
        </a>
        <div className="flex  ml-4 space-x-6 justify-center">
          <img src="/OCF_icon_wht.svg" alt="ofc" width={100} />
        </div>
      </div>
    </footer>
  );
}
