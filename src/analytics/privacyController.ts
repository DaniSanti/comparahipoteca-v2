import type { createConsentStore, ConsentPreference } from "./consent.ts";
import type { createGoogleAnalytics } from "./googleAnalytics.ts";

export function createPrivacyController(options: {
  store: ReturnType<typeof createConsentStore>;
  analytics: ReturnType<typeof createGoogleAnalytics>;
  clearCookies: () => void;
  reload: () => void;
}) {
  const { store, analytics, clearCookies, reload } = options;
  return {
    changeConsent(next: ConsentPreference) {
      const previous = store.getSnapshot();
      if (next === "rejected") {
        analytics.revoke();
        clearCookies();
      }
      store.set(next);
      if (next === "accepted") analytics.initialise();
      if (previous === "accepted" && next === "rejected") reload();
    },
    synchroniseStoredPreference() {
      const previous = store.getSnapshot();
      const next = store.readStored();
      if (previous === "accepted" && next !== "accepted") {
        analytics.revoke();
        clearCookies();
        store.set(next, false);
        reload();
      } else {
        store.set(next, false);
        if (next === "accepted") analytics.initialise();
      }
    },
  };
}
