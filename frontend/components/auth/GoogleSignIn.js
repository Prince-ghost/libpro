"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import Alert from "@/components/ui/Alert";
import { safeNext } from "@/lib/redirect";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Google's library should be initialised once per page load, so later mounts reuse the same slot.
let initialised = false;
let activeCallback = null;

export default function GoogleSignIn() {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const holder = useRef(null);
  const handlerRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onCredential(response) {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle(response.credential);
      router.replace(next);
    } catch (err) {
      setError(err?.message ?? "Google sign-in failed. Please try again.");
      setBusy(false);
    }
  }

  // Keep the newest handler available to Google's callback.
  useEffect(() => {
    handlerRef.current = onCredential;
  });

  // Once Google's script has loaded, draw Google's own button.
  useEffect(() => {
    if (!scriptReady || !CLIENT_ID || !holder.current) return;
    const gsi = window.google?.accounts?.id;
    if (!gsi) return;

    activeCallback = (response) => handlerRef.current?.(response);
    if (!initialised) {
      gsi.initialize({
        client_id: CLIENT_ID,
        callback: (response) => activeCallback?.(response),
        auto_select: false,
      });
      initialised = true;
    }
    const width = Math.max(200, Math.min(400, holder.current.offsetWidth || 320));
    gsi.renderButton(holder.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width,
    });
  }, [scriptReady]);

  // Not configured: show nothing at all, so there is no dead button.
  if (!CLIENT_ID) return null;

  return (
    <div>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError("Could not load Google sign-in. Check your connection and refresh.")}
      />
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {busy && (
        <p role="status" className="text-center text-sm text-muted">
          Signing you in…
        </p>
      )}
      <div ref={holder} className={`flex justify-center ${busy ? "hidden" : ""}`} />
      <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}