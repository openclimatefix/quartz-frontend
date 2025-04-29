import { useEffect, useState } from "react";

export const useUserMenu = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const handleEscape = (e: KeyboardEvent) => {
    console.log("key", e.key);
    if (e.key === "Escape") {
      console.log("escaping");
      setShowUserMenu(false);
    }
  };

  useEffect(() => {
    const handleProfileDropdownToggle = () => {
      if (showUserMenu) {
        window.onkeydown = handleEscape;
      } else {
        window.removeEventListener("keydown", handleEscape);
      }
    };
    console.log("showProfileDropdown", showUserMenu);
    handleProfileDropdownToggle();
  }, [showUserMenu]);
  return {
    showUserMenu,
    setShowUserMenu,
  };
};
