import { useCallback, useEffect, useState } from "react";
import {
  getLatestEuribor,
  retryLatestEuribor,
  type EuriborData,
} from "../../services/euribor";

type EuriborRequestState =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly data: EuriborData }
  | { readonly status: "error" };

export const useEuribor = () => {
  const [state, setState] = useState<EuriborRequestState>({ status: "loading" });

  const settle = useCallback((request: Promise<EuriborData>) => {
    request.then(
      (data) => setState({ status: "success", data }),
      () => setState({ status: "error" }),
    );
  }, []);

  useEffect(() => {
    settle(getLatestEuribor());
  }, [settle]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    settle(retryLatestEuribor());
  }, [settle]);

  return { state, retry };
};
