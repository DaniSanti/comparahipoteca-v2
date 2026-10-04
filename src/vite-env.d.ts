
/// <reference types="vite/client" />

interface Window {
  dataLayer?: Array<Record<string, unknown>>;
}

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export {};
