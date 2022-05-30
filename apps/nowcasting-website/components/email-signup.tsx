interface IEmailSignup {}

const EmailSignup = ({}: IEmailSignup) => {
  return (
    <>
      <p className="text-base font-medium text-gray-900">
        Sign up to be notified when it&apos;s released.
      </p>
      <form
        action="https://openclimatefix.us20.list-manage.com/subscribe/post?u=ceb017fe32f0a4620227fda8a&amp;id=b88570c490"
        method="post"
        id="mc-embedded-subscribe-form"
        name="mc-embedded-subscribe-form"
        target="_blank"
        noValidate
        className="mt-3 sm:max-w-lg sm:w-full sm:flex"
      >
        <div className="flex-1 min-w-0">
          <label htmlFor="mce-EMAIL" className="sr-only">
            Email address
          </label>
          <input
            id="mce-EMAIL"
            type="email"
            name="EMAIL"
            className="block w-full px-5 py-3 text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            placeholder="Enter your email"
          />
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-3">
          <button
            type="submit"
            className="block w-full px-5 py-3 text-base font-medium border border-transparent rounded-md shadow bg-ocf-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 sm:px-10"
          >
            Notify me
          </button>
        </div>
        {/* real people should not fill this in and expect good things - do not remove this or risk form bot signups */}
        <div className="absolute -left-96" aria-hidden="true">
          <input
            type="text"
            name="b_ceb017fe32f0a4620227fda8a_b88570c490"
            tabIndex={-1}
          />
        </div>
        <input
          type="checkbox"
          id="gdpr_58391"
          name="gdpr[58391]"
          value="Y"
          checked
          className="hidden"
          tabIndex={-1}
        />
      </form>
      <p className="mt-3 text-sm text-gray-500">
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
    </>
  );
};

export default EmailSignup;
