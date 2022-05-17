const LoadStateMap = ({children}: { children: React.ReactNode }) => (
  <div className="relative h-full">
    <div className="absolute top-0 left-0 z-10 px-2 py-3 m-3 min-w-[20rem]">
      {children}
    </div>
    <div className="map-overlay top"></div>
  </div>
);

export default LoadStateMap;
