const FaildStateMap = ({error}: {error: string}) => (
  <div className="place-items-center min-h-full grid">
    <p className="mt-1 text-3xl text-gray-500">{error}</p>
  </div>
);

export default FaildStateMap;
