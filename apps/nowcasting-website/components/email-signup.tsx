interface IEmailSignup {}

const EmailSignup = ({}: IEmailSignup) => {
  return (
    <div>
      <div className="rounded-md shadow">
        <a
          href="https://xrl7e8hi84a.typeform.com/to/dJXWiJku"
          className="flex items-center justify-center w-full px-8 py-3 text-base font-medium text-black border border-transparent rounded-md bg-ocf-yellow-600 hover:bg-ocf-yellow-700 md:py-4 md:text-lg md:px-10"
        >
          Find out more
        </a>
      </div>
      <p className="mt-3 text-sm text-center text-gray-500">
        We care about the protection of your data. Read our{" "}
        <a
          href="https://www.iubenda.com/privacy-policy/92003532"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-gray-900 underline"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
};

export default EmailSignup;
