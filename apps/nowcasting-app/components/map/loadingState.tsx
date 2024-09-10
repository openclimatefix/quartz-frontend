const LoadStateMap = ({ children }: { children: React.ReactNode }) => (
  <>
    <div className="absolute flex items-center justify-center bg-mapbox-black/50 inset-0 z-10 pointer-events-none">
      {children}
    </div>
  </>
);

export default LoadStateMap;
