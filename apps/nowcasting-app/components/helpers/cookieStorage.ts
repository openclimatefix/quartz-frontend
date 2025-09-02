import Cookies from "js-cookie";
export enum CookieStorageKeys {
  "DASHBOARD_MODE" = "dashboardMode",
  "N_HOUR_VIEW" = "NHourView",
  "VISIBLE_LINES" = "visibleLines",
  "CONSTRAINTS" = "constraints"
}

export const getSettingFromCookieStorage = <T>(key: string): null | T => {
  const item = Cookies.get(key);
  if (!item) return null;

  return JSON.parse(item);
};

export const setSettingInCookieStorage = <T>(key: string, value: T) => {
  if (typeof window === "undefined") return;

  Cookies.set(key, JSON.stringify(value));
};

export const getBooleanSettingFromCookieStorage = (
  key: string,
  defaultBool: boolean = false
): boolean => {
  const item = getSettingFromCookieStorage<boolean>(key);
  if (item === null) return defaultBool;

  return item;
};

export const setBooleanSettingInLocalStorage = (key: string, value: boolean) => {
  setSettingInCookieStorage<boolean>(key, value);
};

export const getArraySettingFromCookieStorage = <T>(key: string): T[] | null => {
  const array = getSettingFromCookieStorage<T[]>(key);
  if (array === null) return null;

  return array;
};

export const setArraySettingInCookieStorage = <T>(key: string, value: T[]) => {
  setSettingInCookieStorage<T[]>(key, value);
};
