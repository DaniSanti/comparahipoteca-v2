import type { MortgageInput } from "../domain/mortgage.ts";

export function createCalculationTracker(options: {
  canTrack: () => boolean;
  emit: () => boolean;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
}) {
  const schedule = options.schedule ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
  const cancel = options.cancel ?? ((timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  const seen = new Set<string>();
  let timer: unknown;
  const stop = () => {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  };
  return {
    stop,
    observe(input: MortgageInput, valid: boolean, userModified: boolean) {
      stop();
      if (!valid || !userModified || !options.canTrack()) return;
      // Financial data is used only for in-memory deduplication, never as event parameters.
      const signature = JSON.stringify(input);
      if (seen.has(signature)) return;
      timer = schedule(() => {
        timer = undefined;
        if (options.canTrack() && options.emit()) seen.add(signature);
      }, 900);
    },
  };
}
