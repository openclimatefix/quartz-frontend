import { useUser as oguseUser } from "@auth0/nextjs-auth0";
import { UserProvider as ogUserProvider } from "@auth0/nextjs-auth0";
import { withPageAuthRequired as ogwithPageAuthRequired } from "@auth0/nextjs-auth0";

const fakeuseUser: typeof oguseUser = () => {
  return {
    user: {
      name: "John Doe",
      email: "jhondoe@email.com",
      picture: "https://s.gravatar.com/avatar/...",
    },
    isLoading: false,
    checkSession: async () => {},
  };
};
const fakeUserProvider: typeof ogUserProvider = ({ children }) => {
  return <>{children}</>;
};
const fakeWithPageAuthRequired: typeof ogwithPageAuthRequired = (() => {
  return () => ({ props: {} });
}) as any;

export const useUser = process.env.NEXT_PUBLIC_ENV_NAME === "test" ? fakeuseUser : oguseUser;
export const UserProvider =
  process.env.NEXT_PUBLIC_ENV_NAME === "test" ? fakeUserProvider : ogUserProvider;
export const withPageAuthRequired =
  process.env.NEXT_PUBLIC_ENV_NAME === "test" ? fakeWithPageAuthRequired : ogwithPageAuthRequired;
