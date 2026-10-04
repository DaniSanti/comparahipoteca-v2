import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { calculateMortgage } from "../../domain/mortgageCalculations";
import { validateMortgageInput } from "../../domain/mortgageValidation";
import type { MortgageInput, MortgageType } from "../../domain/mortgage";
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
import { chooseEuriborValue } from "./euriborDefault";
import { useEuribor } from "./useEuribor";

interface FormValues {
  purchasePrice: string;
  savings: string;
  termYears: string;
  type: MortgageType;
  fixedTin: string;
  euribor: string;
  differential: string;
}

const defaultValues: FormValues = {
  purchasePrice: "250000",
  savings: "60000",
  termYears: "25",
  type: "fixed",
  fixedTin: "3.25",
  euribor: "",
  differential: "0.75",
};

const parseNumber = (value: string): number =>
  value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));

const toInput = (values: FormValues): MortgageInput => ({
  purchasePrice: parseNumber(values.purchasePrice),
  savings: parseNumber(values.savings),
  termYears: parseNumber(values.termYears),
  type: values.type,
  fixedTin: values.type === "fixed" ? parseNumber(values.fixedTin) : undefined,
  euribor: values.type === "variable" ? parseNumber(values.euribor) : undefined,
  differential:
    values.type === "variable" ? parseNumber(values.differential) : undefined,
});

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
  const [simulations, setSimulations] = useState<readonly MortgageSnapshot[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const euriborManuallyEdited = useRef(false);
  const { state: euriborState, retry: retryEuribor } = useEuribor();
  const input = useMemo(() => toInput(values), [values]);
  const errors = useMemo(() => validateMortgageInput(input), [input]);
  const result = useMemo(() => calculateMortgage(input), [input]);
  const isFull = simulations.length >= MAX_COMPARISONS;

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

  const update = <Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
  ) => setValues((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
  };

  const addCurrent = () => {
    if (!result || isFull) return;
    setSimulations((current) =>
      addSimulation(current, createMortgageSnapshot(input, result)),
    );
  };

  const share = async (snapshot: MortgageSnapshot) => {
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

    setFallbackUrl("");

    try {
      if (navigator.share) {
        await navigator.share({ title: "Simulación hipotecaria", url });
        setShareFeedback("Enlace compartido.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Enlace copiado al portapapeles.");
      } else {
        setFallbackUrl(url);
        setShareFeedback("Copia este enlace para compartir la simulación.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      setFallbackUrl(url);
      setShareFeedback("No se pudo copiar automáticamente. Copia este enlace.");
    }
  };

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">ComparaHipoteca</p>
        <h1>Simulador hipotecario</h1>
        <p>
          Calcula una estimación clara de tu hipoteca y compara hasta cinco
          escenarios.
        </p>
      </header>

      {loaded.shared && (
        <p className="shared-notice" role="status">
          Simulación cargada desde un enlace compartido.
        </p>
      )}

      <div className="simulator-layout">
        <form className="panel form-panel" onSubmit={submit} noValidate>
          <h2>Datos de la compra</h2>
          <div className="field-grid">
            <NumberField
              id="purchasePrice"
              label="Precio de compra"
              suffix="€"
              value={values.purchasePrice}
              onChange={(value) => update("purchasePrice", value)}
              error={showErrors ? errors.purchasePrice : undefined}
            />
            <NumberField
              id="savings"
              label="Ahorro o aportación"
              suffix="€"
              value={values.savings}
              onChange={(value) => update("savings", value)}
              error={showErrors ? errors.savings : undefined}
            />
            <NumberField
              id="termYears"
              label="Plazo"
              suffix="años"
              value={values.termYears}
              onChange={(value) => update("termYears", value)}
              error={showErrors ? errors.termYears : undefined}
              step="1"
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
              label="TIN anual"
              suffix="%"
              value={values.fixedTin}
              onChange={(value) => update("fixedTin", value)}
              error={showErrors ? errors.fixedTin : undefined}
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
                  error={showErrors ? errors.euribor : undefined}
                />
                <NumberField
                  id="differential"
                  label="Diferencial"
                  suffix="%"
                  value={values.differential}
                  onChange={(value) => update("differential", value)}
                  error={showErrors ? errors.differential : undefined}
                />
              </div>
              <EuriborStatus state={euriborState} onRetry={retryEuribor} />
            </div>
          )}

          <button type="submit">Calcular hipoteca</button>
          <p className="form-note">
            Estimación orientativa. Los gastos se calculan como un 10 % del
            precio.
          </p>
        </form>

        <section
          className="panel results-panel"
          aria-live="polite"
          aria-labelledby="results-title"
        >
          <h2 id="results-title">Tu estimación</h2>
          {result ? (
            <>
              <div className="primary-result">
                <span>Cuota mensual estimada</span>
                <strong>{money.format(result.monthlyPayment)}</strong>
                <small>
                  TIN aplicado: {percent.format(result.annualInterestRate)} %
                </small>
              </div>
              <dl className="result-list">
                <Result
                  label="Importe financiado"
                  value={money.format(result.financedAmount)}
                />
                <Result
                  label="Gastos de compra estimados"
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
              <button
                type="button"
                className="add-button"
                onClick={addCurrent}
                disabled={isFull}
              >
                Añadir a comparación
                <span>{simulations.length} de 5</span>
              </button>
              {isFull && (
                <p className="limit-note">
                  Has alcanzado el máximo de 5 simulaciones.
                </p>
              )}
            </>
          ) : (
            <p className="empty-result">
              Revisa los datos para obtener una estimación.
            </p>
          )}
        </section>
      </div>

      <ComparisonTable
        simulations={simulations}
        onRemove={(id) =>
          setSimulations((current) => removeSimulation(current, id))
        }
        onShare={share}
      />

      <div className="share-feedback" aria-live="polite">
        {shareFeedback}
        {fallbackUrl && (
          <div className="copy-field">
            <input
              aria-label="Enlace para compartir"
              readOnly
              value={fallbackUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
      </div>
    </main>
  );
}

interface EuriborStatusProps {
  state: ReturnType<typeof useEuribor>["state"];
  onRetry: () => void;
}

function EuriborStatus({ state, onRetry }: EuriborStatusProps) {
  if (state.status === "loading") {
    return <p className="euribor-status">Consultando último Euríbor oficial…</p>;
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
      Euríbor oficial: {percent.format(state.data.value)} % ·{" "}
      {referenceMonth.format(state.data.date)} · {state.data.source}. El campo
      sigue siendo editable.
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
  step?: string;
}

function NumberField({
  id,
  label,
  suffix,
  value,
  onChange,
  error,
  step = "any",
}: NumberFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <span>{suffix}</span>
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
