"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// Loads the logged-in person's addresses. reload() asks the server again.
export function useAddresses() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: -1, items: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    api("/api/addresses", { signal: controller.signal })
      .then(({ data }) => setResult({ key: attempt, items: data, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult((prev) => ({ key: attempt, items: prev.items, error: err }));
      });
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { loaded: result.key !== -1, items: result.items, error: result.error, reload };
}