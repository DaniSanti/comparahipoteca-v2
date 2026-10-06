import { MortgageSimulator } from "./features/simulator/MortgageSimulator";
import { useSyncExternalStore } from "react";
import { consentStore } from "./analytics/runtime";
import { ConsentMetrics } from "./analytics/ConsentMetrics";
import { PrivacyControls } from "./features/privacy/PrivacyControls";

export default function App() {
  const consent = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getServerSnapshot);
  return (
    <>
      <MortgageSimulator />
      <PrivacyControls consent={consent} />
      <ConsentMetrics consent={consent} />
    </>
  );
}
