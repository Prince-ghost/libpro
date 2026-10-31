"use client";

import { useEffect, useState } from "react";
import { api, API_URL } from "@/lib/api";

export default function ApiStatus() {
  const [kind, setKind] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();
    api("/api/health", { signal: controller.signal })
      .then(() => setKind("ok"))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setKind(err?.status === 503 ? "db" : "down");
      });
    return () => controller.abort();
  }, []);

  const views = {
    checking: {
      icon: "…",
      text: "Checking the connection to the BookBack API…",
      style: "border-line bg-surface text-muted",
    },
    ok: {
      icon: "✓",
      text: "Connected to the BookBack API.",
      style: "border-brand/30 bg-brand/5 text-brand-dark",
    },
    db: {
      icon: "!",
      text: "The API is running, but its database is unavailable.",
      style: "border-danger/30 bg-danger/5 text-danger",
    },
    down: {
      icon: "!",
      text: `Can't reach the API at ${API_URL}. Is the backend running?`,
      style: "border-danger/30 bg-danger/5 text-danger",
    },
  };
  const view = views[kind];

  return (
    <p
      role="status"
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-left text-sm ${view.style}`}
    >
      <span aria-hidden="true" className="font-bold">
        {view.icon}
      </span>
      {view.text}
    </p>
  );
}