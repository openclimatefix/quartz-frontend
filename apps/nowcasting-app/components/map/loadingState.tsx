const LoadStateMap = ({ children }: { children: React.ReactNode }) => (
  <>
    <div className="absolute flex items-center justify-center bg-mapbox-black/75 inset-0 z-20 pointer-events-none">
      {children}
    </div>
  </>
);

export default LoadStateMap;
