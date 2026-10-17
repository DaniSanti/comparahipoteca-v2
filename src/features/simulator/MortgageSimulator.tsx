import { useEffect, useMemo, useRef, useState } from "react";
import { calculateMortgage } from "../../domain/mortgageCalculations";
import type { MortgageField } from "../../domain/mortgageValidation";
import type { MortgageInput } from "../../domain/mortgage";
import { AmortizationTable } from "../amortization/AmortizationTable";
import { ComparisonTable } from "../comparison/ComparisonTable";
import {
  addSimulation,
  createMortgageSnapshot,
  MAX_COMPARISONS,
  removeSimulation,
  type MortgageSnapshot,
} from "../comparison/comparisonState";
import {
  parseSharedSimulation,
  serializeSharedSimulation,
} from "../sharing/sharedSimulation";
import {
  getCalculationIssue,
  getVisibleErrors,
  type TouchedFields,
} from "./formValidation";
import { shareLink } from "../sharing/shareLink";
import { chooseEuriborValue } from "./euriborDefault";
import { useEuribor } from "./useEuribor";
import { ContributionLabel } from "./ContributionLabel";
import { contributionPercent, savingsFromPercent } from "./contribution";
import { toMortgageInput, validateFormValues, type FormValues } from "./numberInput";
import { analytics, trackEvent } from "../../analytics/runtime";
import { createCalculationTracker } from "../../analytics/calculationTracking";

const defaultValues: FormValues = {
  purchasePrice: "250000",
  savings: "60000",
  termYears: "25",
  type: "fixed",
  fixedTin: "3.25",
  euribor: "",
  differential: "0.75",
};

const fromInput = (input: MortgageInput): FormValues => ({
  purchasePrice: String(input.purchasePrice),
  savings: String(input.savings),
  termYears: String(input.termYears),
  type: input.type,
  fixedTin:
    input.type === "fixed" ? String(input.fixedTin) : defaultValues.fixedTin,
  euribor:
    input.type === "variable" ? String(input.euribor) : defaultValues.euribor,
  differential:
    input.type === "variable"
      ? String(input.differential)
      : defaultValues.differential,
});

const initialState = (): { values: FormValues; shared: boolean } => {
  if (typeof window === "undefined") {
    return { values: defaultValues, shared: false };
  }

  const shared = parseSharedSimulation(window.location.href);
  return shared
    ? { values: fromInput(shared), shared: true }
    : { values: defaultValues, shared: false };
};

const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
const referenceMonth = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function MortgageSimulator() {
  const [loaded] = useState(initialState);
  const [values, setValues] = useState(loaded.values);
  const [userRevision, setUserRevision] = useState(0);
  const [calculationTracker] = useState(() => createCalculationTracker({
    canTrack: analytics.canTrack,
    emit: () => trackEvent("mortgage_calculated"),
  }));
  const manualShareTracked = useRef(false);
  const [percentDraft, setPercentDraft] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<readonly MortgageSnapshot[]>([]);
  const [amortizationSelection, setAmortizationSelection] = useState({ id: "", request: 0 });
  const selectedSnapshot = simulations.find((item) => item.id === amortizationSelection.id) ?? simulations[0];
  const selectedResult = useMemo(() => selectedSnapshot ? calculateMortgage(selectedSnapshot) : null, [selectedSnapshot]);
  const amortizationNumber = selectedSnapshot ? simulations.indexOf(selectedSnapshot) + 1 : 1;
  const [touched, setTouched] = useState<TouchedFields>({});
  const [comparisonFeedback, setComparisonFeedback] = useState("");
  const [resultAnnouncement, setResultAnnouncement] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const resultsTitleRef = useRef<HTMLHeadingElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const euriborManuallyEdited = useRef(false);
  const { state: euriborState, retry: retryEuribor } = useEuribor();
  const input = useMemo(() => toMortgageInput(values), [values]);
  const errors = useMemo(() => validateFormValues(values), [values]);
  const result = useMemo(() => Object.keys(errors).length ? null : calculateMortgage(input), [input, errors]);
  const amortizationResult = selectedResult ?? result;
  const visibleErrors = getVisibleErrors(errors, touched);
  const calculationIssue = getCalculationIssue(errors);
  const isFull = simulations.length >= MAX_COMPARISONS;

  useEffect(() => {
    analytics.sharedSimulationOpened(loaded.shared);
  }, [loaded.shared]);

  useEffect(() => {
    calculationTracker.observe(input, result !== null, userRevision > 0);
    return calculationTracker.stop;
  }, [input, result, userRevision, calculationTracker]);

  useEffect(() => {
    if (euriborState.status !== "success") return;
    setValues((current) => ({
      ...current,
      euribor: chooseEuriborValue({
        currentValue: current.euribor,
        officialValue: euriborState.data.value,
        isSharedVariable: loaded.shared && loaded.values.type === "variable",
        wasManuallyEdited: euriborManuallyEdited.current,
      }),
    }));
  }, [euriborState, loaded]);

  // Announce a concise result after typing pauses, rather than the whole panel.
  const announcement = result
    ? `Cuota mensual estimada: ${money.format(result.monthlyPayment)}. TIN aplicado: ${percent.format(result.annualInterestRate)} %.`
    : `No se puede calcular la cuota. ${calculationIssue}`;
  useEffect(() => {
    const timer = window.setTimeout(() => setResultAnnouncement(announcement), 500);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  useEffect(() => {
    if (fallbackUrl) fallbackRef.current?.focus();
  }, [fallbackUrl]);

  const touch = (field: MortgageField) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const update = <Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
  ) => {
    if (values[field] === value) return;
    if (field === "savings" || field === "purchasePrice") setPercentDraft(null);
    setUserRevision((current) => current + 1);
    setValues((current) => ({ ...current, [field]: value }));
  };

  const updatePercent = (value: string) => {
    if (value !== "" && (!/^\d+$/.test(value) || Number(value) > 100)) return;
    setPercentDraft(value);
    setUserRevision((current) => current + 1);
    setValues((current) => ({
      ...current,
      savings: value === "" ? "" : savingsFromPercent(current.purchasePrice, value),
    }));
  };

  const addCurrent = () => {
    if (!result || isFull) return;
    setSimulations((current) =>
      addSimulation(current, createMortgageSnapshot(input, result)),
    );
    trackEvent("comparison_added");
    setComparisonFeedback(
      `Hipoteca ${simulations.length + 1} añadida. ${simulations.length + 1} de ${MAX_COMPARISONS} simulaciones.${simulations.length + 1 === MAX_COMPARISONS ? " Máximo alcanzado. Elimina una para añadir otra." : ""}`,
    );
  };

  const removeCurrent = (id: string) => {
    const index = simulations.findIndex((item) => item.id === id);
    if (index < 0) return;
    setSimulations((current) => removeSimulation(current, id));
    trackEvent("comparison_removed");
    setComparisonFeedback(
      `Hipoteca ${index + 1} eliminada. ${simulations.length - 1} de ${MAX_COMPARISONS} simulaciones. Puedes añadir otra.`,
    );
    if (simulations.length === 1) {
      if (result) addButtonRef.current?.focus({ preventScroll: true });
      else resultsTitleRef.current?.focus({ preventScroll: true });
    }
  };

  const share = async (snapshot: MortgageSnapshot, number: number) => {
    if (sharingId) return;
    const shareInput: MortgageInput =
      snapshot.type === "fixed"
        ? {
            purchasePrice: snapshot.purchasePrice,
            savings: snapshot.savings,
            termYears: snapshot.termYears,
            type: "fixed",
            fixedTin: snapshot.fixedTin,
          }
        : {
            purchasePrice: snapshot.purchasePrice,
            savings: snapshot.savings,
            termYears: snapshot.termYears,
            type: "variable",
            euribor: snapshot.euribor,
            differential: snapshot.differential,
          };
    const url = serializeSharedSimulation(shareInput, window.location.href);

    const label = `Hipoteca ${number}`;
    setFallbackUrl("");
    manualShareTracked.current = false;
    setShareFeedback(`Compartiendo ${label}…`);
    setSharingId(snapshot.id);
    const outcome = await shareLink(url, `${label} · ComparaHipoteca`, {
      share: navigator.share ? (data) => navigator.share(data) : undefined,
      copy: navigator.clipboard?.writeText
        ? (link) => navigator.clipboard.writeText(link)
        : undefined,
    });
    setSharingId(null);
    const messages = {
      shared: `${label}: enlace compartido.`,
      copied: `${label}: enlace copiado al portapapeles.`,
      cancelled: `${label}: se ha cancelado compartir.`,
      manual: `${label}: no se pudo compartir ni copiar automáticamente. Copia el enlace de abajo.`,
    };
    setShareFeedback(messages[outcome]);
    if (outcome === "shared" || outcome === "copied") {
      trackEvent("simulation_shared", { method: outcome === "shared" ? "native" : "clipboard" });
    }
    if (outcome === "manual") setFallbackUrl(url);
  };

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">ComparaHipoteca</p>
        <h1>Simulador hipotecario</h1>
        <p>Explora tu cuota y compara hasta 5 hipotecas.</p>
      </header>

      {loaded.shared && (
        <p className="shared-notice" role="status">
          Simulación cargada desde un enlace compartido.
        </p>
      )}

      <div className="simulator-layout">
        <form
          className="panel form-panel"
          onSubmit={(event) => event.preventDefault()}
          noValidate
          aria-labelledby="form-title"
        >
          <h2 id="form-title">Datos de tu hipoteca</h2>
          <div className="field-grid">
            <NumberField
              id="purchasePrice"
              label="Precio de compra"
              suffix="€"
              value={values.purchasePrice}
              onChange={(value) => update("purchasePrice", value)}
              onBlur={() => touch("purchasePrice")}
              error={visibleErrors.purchasePrice}
            />
            <div className="contribution-field">
              <div className="contribution-inputs">
                <NumberField
                  id="savings"
                  label="Aportación"
                  suffix="€"
                  value={values.savings}
                  onChange={(value) => update("savings", value)}
                  onBlur={() => touch("savings")}
                  error={visibleErrors.savings}
                />
                <NumberField
                  id="savingsPercent"
                  label="% de aportación"
                  suffix="%"
                  value={percentDraft ?? contributionPercent(values.purchasePrice, values.savings)}
                  onChange={updatePercent}
                  onBlur={() => { setPercentDraft(null); touch("savings"); }}
                  integer
                  min={0}
                  max={100}
                  disabled={!Number.isFinite(input.purchasePrice) || input.purchasePrice <= 0}
                />
              </div>
            </div>
            <NumberField
              id="termYears"
              label="Plazo"
              suffix="años"
              value={values.termYears}
              onChange={(value) => update("termYears", value)}
              onBlur={() => touch("termYears")}
              error={visibleErrors.termYears}
              integer
            />
          </div>

          <fieldset>
            <legend>Tipo de hipoteca</legend>
            <div className="type-options">
              {(["fixed", "variable"] as const).map((type) => (
                <label
                  className={
                    values.type === type
                      ? "type-option selected"
                      : "type-option"
                  }
                  key={type}
                >
                  <input
                    type="radio"
                    name="mortgageType"
                    value={type}
                    checked={values.type === type}
                    onChange={() => update("type", type)}
                  />
                  {type === "fixed" ? "Fija" : "Variable"}
                </label>
              ))}
            </div>
          </fieldset>

          {values.type === "fixed" ? (
            <NumberField
              id="fixedTin"
              label="TIN fijo anual"
              suffix="%"
              value={values.fixedTin}
              onChange={(value) => update("fixedTin", value)}
              onBlur={() => touch("fixedTin")}
              error={visibleErrors.fixedTin}
            />
          ) : (
            <div>
              <div className="field-grid rate-fields">
                <NumberField
                  id="euribor"
                  label="Euríbor"
                  suffix="%"
                  value={values.euribor}
                  onChange={(value) => {
                    euriborManuallyEdited.current = true;
                    update("euribor", value);
                  }}
                  onBlur={() => touch("euribor")}
                  error={visibleErrors.euribor}
                  describedBy="euribor-source"
                />
                <NumberField
                  id="differential"
                  label="Diferencial"
                  suffix="%"
                  value={values.differential}
                  onChange={(value) => update("differential", value)}
                  onBlur={() => touch("differential")}
                  error={visibleErrors.differential}
                />
              </div>
              <div id="euribor-source">
                <EuriborStatus state={euriborState} onRetry={retryEuribor} />
              </div>
            </div>
          )}
        </form>

        <section
          className="panel results-panel"
          aria-labelledby="results-title"
        >
          <h2 id="results-title" ref={resultsTitleRef} tabIndex={-1}>
            Tu estimación
          </h2>
          {result ? (
            <>
              <div className="primary-result">
                <span>Cuota mensual estimada</span>
                <strong>{money.format(result.monthlyPayment)}</strong>
                <small>
                  {values.type === "variable"
                    ? "TIN: Euríbor + diferencial"
                    : "TIN aplicado"}: {percent.format(result.annualInterestRate)} %
                </small>
              </div>
              {values.type === "variable" && (
                <p className="variable-note">
                  Cuota con el TIN actual; cambiará si varía el Euríbor.
                </p>
              )}
              <dl className="result-list">
                <Result
                  label="Importe financiado"
                  value={money.format(result.financedAmount)}
                />
                <Result
                  label="Gastos estimados"
                  value={money.format(result.purchaseCosts)}
                />
                <Result
                  label="Intereses totales"
                  value={money.format(result.totalInterest)}
                />
                <Result
                  label="Coste total"
                  value={money.format(result.totalCost)}
                  emphasized
                />
              </dl>
            </>
          ) : (
            <div className="empty-result">
              <p>Corrige los datos para ver la cuota.</p>
              <p>{calculationIssue}</p>
            </div>
          )}
          <p className="form-note">
            Estimación orientativa. Gastos estimados: 10 % del precio de compra.
          </p>
          <button
            ref={addButtonRef}
            type="button"
            className="add-button"
            onClick={addCurrent}
            aria-disabled={!result || isFull || undefined}
            aria-describedby={isFull || !result ? "comparison-limit" : undefined}
          >
            Añadir a comparación
            <span>{simulations.length} de {MAX_COMPARISONS}</span>
          </button>
          {(isFull || !result) && (
            <p className="limit-note" id="comparison-limit">
              {isFull
                ? "Máximo de 5 hipotecas. Elimina una para añadir otra."
                : "Corrige los datos antes de añadir esta hipoteca."}
            </p>
          )}
        </section>
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        {resultAnnouncement}
      </p>
      <p className="comparison-feedback" role="status" aria-atomic="true">
        {comparisonFeedback}
      </p>

      <ComparisonTable
        simulations={simulations}
        onRemove={removeCurrent}
        onAmortization={(snapshot) => setAmortizationSelection((current) => ({ id: snapshot.id, request: current.request + 1 }))}
        sharingId={sharingId}
        onShare={share}
      />

      <div className="share-feedback">
        <p role="status" aria-atomic="true">{shareFeedback}</p>
        {fallbackUrl && (
          <div className="copy-field">
            <label htmlFor="share-url">Enlace de la hipoteca para compartir</label>
            <input
              id="share-url"
              ref={fallbackRef}
              readOnly
              value={fallbackUrl}
              onFocus={(event) => event.currentTarget.select()}
              onCopy={() => {
                if (manualShareTracked.current) return;
                manualShareTracked.current = true;
                trackEvent("simulation_shared", { method: "manual" });
              }}
            />
          </div>
        )}
      </div>

      {amortizationResult && <AmortizationTable
        result={amortizationResult}
        variable={(selectedSnapshot?.type ?? values.type) === "variable"}
        mortgageNumber={amortizationNumber}
        revealRequest={selectedSnapshot ? amortizationSelection.request : 0}
      />}
    </main>
  );
}

interface EuriborStatusProps {
  state: ReturnType<typeof useEuribor>["state"];
  onRetry: () => void;
}

function EuriborStatus({ state, onRetry }: EuriborStatusProps) {
  if (state.status === "loading") {
    return (
      <p className="euribor-status" role="status">
        Consultando Euríbor del Banco de España… Puedes editarlo.
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div className="euribor-status euribor-error" role="status">
        <span>
          No se ha podido obtener el último Euríbor. Puedes introducirlo
          manualmente.
        </span>
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    );
  }
  return (
    <p className="euribor-status" role="status">
      Euríbor oficial del Banco de España: {percent.format(state.data.value)} % ·{" "}
      {referenceMonth.format(state.data.date)}. Puedes editarlo para explorar
      escenarios.
    </p>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur: () => void;
  describedBy?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function NumberField({
  id,
  label,
  suffix,
  value,
  onChange,
  onBlur,
  describedBy,
  error,
  integer = false,
  min,
  max,
  disabled,
}: NumberFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field">
      {id === "savings" ? <ContributionLabel /> : <label htmlFor={id}>{label}</label>}
      <div className="input-wrap">
        <input
          id={id}
          name={id}
          type={integer ? "number" : "text"}
          inputMode={integer ? "numeric" : "decimal"}
          step={integer ? "1" : undefined}
          min={min}
          max={max}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={[
            `${id}-unit`,
            describedBy,
            error ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ")}
        />
        <span id={`${id}-unit`}>{suffix}</span>
      </div>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

interface ResultProps {
  label: string;
  value: string;
  emphasized?: boolean;
}

function Result({ label, value, emphasized = false }: ResultProps) {
  return (
    <div className={emphasized ? "result-row emphasized" : "result-row"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
