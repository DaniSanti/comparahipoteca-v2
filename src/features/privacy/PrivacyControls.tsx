import { useEffect, useRef, useState } from "react";
import type { ConsentPreference, ConsentState } from "../../analytics/consent";
import { changeAnalyticsConsent } from "../../analytics/runtime";
import { getFocusScrollDistance } from "./focusVisibility";

export function PrivacyControls({ consent }: { consent: ConsentState }) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(300);
  const bannerRef = useRef<HTMLElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const preferencesRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const visible = consent === "undecided" || preferencesOpen;

  useEffect(() => {
    if (!visible || !bannerRef.current) return;
    const banner = bannerRef.current;
    const measure = () => setBannerHeight(banner.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (preferencesOpen) acceptRef.current?.focus();
  }, [preferencesOpen]);

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const keepFocusVisible = () => {
      cancelAnimationFrame(frame);
      // Run after the browser's own keyboard scroll, accounting for the overlay.
      frame = requestAnimationFrame(() => {
        const target = document.activeElement;
        const banner = bannerRef.current;
        if (!(target instanceof HTMLElement) || !banner || banner.contains(target)) return;
        const distance = getFocusScrollDistance(target.getBoundingClientRect(), banner.getBoundingClientRect());
        if (distance) window.scrollBy({ top: distance, behavior: "instant" });
      });
    };
    document.addEventListener("focusin", keepFocusVisible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", keepFocusVisible);
    };
  }, [visible]);

  const choose = (next: ConsentPreference) => {
    changeAnalyticsConsent(next);
    setPreferencesOpen(false);
    // The action that opened the options remains available after they close.
    const returnTo = returnFocusRef.current ?? document.getElementById("purchasePrice");
    returnTo?.focus();
  };

  return (
    <>
      <footer className="privacy-footer" style={{ paddingBottom: visible ? bannerHeight + 32 : 24 }}>
        <button
          ref={preferencesRef}
          type="button"
          className="privacy-link"
          onClick={() => setPreferencesOpen(true)}
          aria-expanded={visible}
          aria-controls={visible ? "privacy-options" : undefined}
        >
          Preferencias de privacidad
        </button>
        <p role="status">{consent !== "undecided" ? `Analítica ${consent === "accepted" ? "aceptada" : "rechazada"}.` : ""}</p>
      </footer>
      {visible && (
        <section
          id="privacy-options"
          ref={bannerRef}
          className="consent-banner"
          aria-labelledby="privacy-title"
          aria-describedby="privacy-description"
          onFocusCapture={(event) => {
            const previous = event.relatedTarget;
            if (previous instanceof HTMLElement && !event.currentTarget.contains(previous)) {
              returnFocusRef.current = previous;
            }
          }}
        >
          <h2 id="privacy-title">Analítica y privacidad</h2>
          <p id="privacy-description">
            Usamos Google Analytics y métricas de rendimiento para entender cómo se utiliza
            ComparaHipoteca y mejorarla. Solo se activan si aceptas.
          </p>
          <div className="consent-actions">
            <button ref={acceptRef} type="button" onClick={() => choose("accepted")}>
              Aceptar analíticas
            </button>
            <button type="button" onClick={() => choose("rejected")}>Rechazar</button>
          </div>
          <details className="consent-details">
            <summary>Más información</summary>
            <p>
              Google Analytics 4 registra acciones generales de uso. Vercel Speed Insights
              mide el rendimiento. La finalidad es exclusivamente analítica y de rendimiento;
              no enviamos los datos financieros de los campos ni las URLs de las simulaciones.
            </p>
            <p>
              Guardamos solo esta elección en tu navegador. Puedes cambiarla en
              «Preferencias de privacidad». Al revocar la aceptación recargamos la página
              para detener las métricas.
            </p>
          </details>
        </section>
      )}
    </>
  );
}
