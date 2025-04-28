import { UserProvider } from "@auth0/nextjs-auth0/client";

const DevUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = {
    id: "123456",
    email: "dev.user@email.com",
    picture: "/favicon.ico",
    username: "DevUser",
    name: "Dev User",
    locale: "en"
  };
  return <UserProvider user={user}>{children}</UserProvider>;
};
const CustomUserProvider =
  process.env.NEXT_PUBLIC_DEV_MODE === "true" ? DevUserProvider : UserProvider;
export default CustomUserProvider;
