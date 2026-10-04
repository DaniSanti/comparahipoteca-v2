export const EURIBOR_SERIES = "D_1NBAF472";
export const EURIBOR_ENDPOINT =
  "https://app.bde.es/bierest/resources/srdatosapp/favoritas?idioma=es&series=D_1NBAF472";

const REQUEST_TIMEOUT_MS = 7_000;
const EURIBOR_MIN = -5;
const EURIBOR_MAX = 25;

export interface BancoDeEspanaSeriesEntry {
  readonly serie?: unknown;
  readonly descripcionCorta?: unknown;
  readonly codFrecuencia?: unknown;
  readonly fechaValor?: unknown;
  readonly valor?: unknown;
}

export interface EuriborData {
  readonly value: number;
  readonly date: Date;
  readonly source: "Banco de España";
  readonly series: typeof EURIBOR_SERIES;
}

export class EuriborServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EuriborServiceError";
  }
}

const parseValue = (value: unknown): number => {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new EuriborServiceError("La respuesta no contiene un valor Euríbor");
  }

  const normalized =
    typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;
  if (!Number.isFinite(normalized)) {
    throw new EuriborServiceError("El valor Euríbor no es numérico");
  }
  if (normalized < EURIBOR_MIN || normalized > EURIBOR_MAX) {
    throw new EuriborServiceError("El valor Euríbor está fuera de los límites admitidos");
  }
  return normalized;
};

const parseDate = (value: unknown): Date => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new EuriborServiceError("La respuesta no contiene una fecha de referencia");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new EuriborServiceError("La fecha de referencia no es válida");
  }
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (
    calendarDate &&
    (date.getUTCFullYear() !== Number(calendarDate[1]) ||
      date.getUTCMonth() + 1 !== Number(calendarDate[2]) ||
      date.getUTCDate() !== Number(calendarDate[3]))
  ) {
    throw new EuriborServiceError("La fecha de referencia no es válida");
  }
  return date;
};

const isMonthly = (frequency: unknown): boolean => {
  if (frequency === undefined || frequency === null || frequency === "") return true;
  if (typeof frequency !== "string") return false;
  const normalized = frequency.trim().toLocaleLowerCase("es-ES");
  return normalized === "m" || normalized === "mensual";
};

export const parseEuriborResponse = (payload: unknown): EuriborData => {
  if (!Array.isArray(payload)) {
    throw new EuriborServiceError("La respuesta del Banco de España no es un array");
  }

  const entry = payload.find(
    (candidate): candidate is BancoDeEspanaSeriesEntry =>
      typeof candidate === "object" &&
      candidate !== null &&
      "serie" in candidate &&
      candidate.serie === EURIBOR_SERIES,
  );
  if (!entry) {
    throw new EuriborServiceError("La respuesta no contiene la serie Euríbor esperada");
  }
  if (entry.serie !== EURIBOR_SERIES) {
    throw new EuriborServiceError("La serie recibida no es la esperada");
  }
  if (!isMonthly(entry.codFrecuencia)) {
    throw new EuriborServiceError("La serie recibida no tiene frecuencia mensual");
  }

  return Object.freeze({
    value: parseValue(entry.valor),
    date: parseDate(entry.fechaValor),
    source: "Banco de España",
    series: EURIBOR_SERIES,
  });
};

export const requestLatestEuribor = async (
  fetcher: typeof fetch = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<EuriborData> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(EURIBOR_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new EuriborServiceError(
        `El Banco de España ha respondido con HTTP ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new EuriborServiceError("La respuesta no contiene JSON válido");
    }
    return parseEuriborResponse(payload);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new EuriborServiceError("La consulta del Euríbor ha agotado el tiempo de espera");
    }
    if (error instanceof EuriborServiceError) throw error;
    throw new EuriborServiceError("No se ha podido consultar el Euríbor");
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

let currentRequest: Promise<EuriborData> | undefined;

/** Shares the request across consumers and React StrictMode effects for this page lifetime. */
export const getLatestEuribor = (): Promise<EuriborData> => {
  currentRequest ??= requestLatestEuribor();
  return currentRequest;
};

/** A retry is only started in response to an explicit user action. */
export const retryLatestEuribor = (): Promise<EuriborData> => {
  currentRequest = requestLatestEuribor();
  return currentRequest;
};
