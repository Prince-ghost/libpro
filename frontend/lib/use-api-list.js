"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// Loads a list from the API. Changing the path loads the new list, and reload() asks again.
// While a new answer is on its way, the previous items stay available so the screen can fade them.
export function useApiList(path) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${path}#${attempt}`;
  const [result, setResult] = useState({ key: "", items: [], meta: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then(({ data, meta }) => setResult({ key: requestKey, items: data, meta, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({ key: requestKey, items: [], meta: null, error: err });
      });
    return () => controller.abort(); // a newer request cancels the older one
  }, [path, requestKey]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return {
    loading: result.key !== requestKey,
    items: result.items,
    meta: result.meta,
    error: result.error,
    reload,
  };
}