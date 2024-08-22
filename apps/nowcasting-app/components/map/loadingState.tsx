const LoadStateMap = ({ children }: { children: React.ReactNode }) => (
  <>
    <div className="absolute flex items-center justify-center bg-mapbox-black/50 inset-0 z-10 px-2 py-3 m-3 min-w-[20rem]">
      {children}
    </div>
  </>
);

export default LoadStateMap;
