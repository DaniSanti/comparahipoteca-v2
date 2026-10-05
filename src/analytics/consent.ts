export const CONSENT_KEY = "comparahipoteca:analytics-consent:v1";
export type ConsentPreference = "accepted" | "rejected";
export type ConsentState = ConsentPreference | "undecided";
export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createConsentStore(getStorage: () => PreferenceStorage | undefined) {
  const read = (): ConsentState => {
    try {
      const value = getStorage()?.getItem(CONSENT_KEY);
      return value === "accepted" || value === "rejected" ? value : "undecided";
    } catch {
      return "undecided";
    }
  };
  let state = read();
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    getServerSnapshot: (): ConsentState => "undecided",
    readStored: read,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set(next: ConsentState, persist = true) {
      if (persist && next !== "undecided") {
        try { getStorage()?.setItem(CONSENT_KEY, next); } catch { /* Session-only choice. */ }
      }
      if (state === next) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export const shouldMountSpeedInsights = (consent: ConsentState): boolean => consent === "accepted";

export function clearGaCookies(
  cookieJar: { cookie: string },
  hostname: string,
  pathname: string,
) {
  try {
    const names = cookieJar.cookie.split(";").map((cookie) => cookie.trim().split("=")[0])
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    const paths = new Set(["/", pathname]);
    const parts = pathname.split("/").filter(Boolean);
    for (let index = 1; index <= parts.length; index++) {
      paths.add(`/${parts.slice(0, index).join("/")}`);
      paths.add(`/${parts.slice(0, index).join("/")}/`);
    }
    for (const name of names) {
      for (const path of paths) {
        for (const domain of ["", `; Domain=${hostname}`, `; Domain=.${hostname}`]) {
          try {
            cookieJar.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${path}${domain}`;
          } catch { /* Best effort: other cookies must remain untouched. */ }
        }
      }
    }
  } catch { /* Cookie access can be blocked without affecting the simulator. */ }
}
