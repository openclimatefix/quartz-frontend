const FailedStateMap = ({ error }: { error: string }) => (
  <div className="place-items-center min-h-full grid">
    <p className="mt-1 text-3xl text-content-muted">{error}</p>
  </div>
);

export default FailedStateMap;
