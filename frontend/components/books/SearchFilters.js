"use client";

import { useState } from "react";
import { AUDIENCE_LABELS, CONDITION_LABELS } from "@/lib/format";
import { MAX_PRICE_RUPEES } from "@/lib/browse-params";
import FormField from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";

const EMPTY = { q: "", audience: "", condition: "", min: "", max: "" };
const pick = (v) => ({ q: v.q, audience: v.audience, condition: v.condition, min: v.min, max: v.max });
const isPrice = (v) => v === "" || (/^\d{1,6}$/.test(v) && Number(v) <= MAX_PRICE_RUPEES);

export default function SearchFilters({ values, canClear, onApply, onClear }) {
  const [draft, setDraft] = useState(() => pick(values));
  const [syncedWith, setSyncedWith] = useState(() => JSON.stringify(pick(values)));
  const [panelOpen, setPanelOpen] = useState(false);
  const [priceError, setPriceError] = useState("");

  // When the address changes (back button, a link, Clear all) the form follows it.
  const urlKey = JSON.stringify(pick(values));
  if (syncedWith !== urlKey) {
    setSyncedWith(urlKey);
    setDraft(pick(values));
    setPriceError("");
  }

  function onChange(event) {
    const { name, value } = event.target;
    setDraft((d) => ({ ...d, [name]: value }));
  }

  function onSubmit(event) {
    event.preventDefault();
    const min = draft.min.trim();
    const max = draft.max.trim();
    if (!isPrice(min) || !isPrice(max)) {
      setPriceError("Prices must be whole rupee amounts, up to 1,00,000.");
      setPanelOpen(true);
      return;
    }
    if (min && max && Number(min) > Number(max)) {
      setPriceError("The minimum price cannot be higher than the maximum price.");
      setPanelOpen(true);
      return;
    }
    setPriceError("");
    onApply({
      ...values,
      ...draft,
      q: draft.q.replace(/\s+/g, " ").trim().slice(0, 100),
      min,
      max,
      page: 1,
    });
  }

  function clear() {
    setDraft(EMPTY);
    setPriceError("");
    onClear();
  }

  const primaryButton =
    "rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark";

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="q" className="sr-only">
            Search by title, author or course
          </label>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={100}
            value={draft.q}
            onChange={onChange}
            placeholder="Search by title, author or course"
            className="block w-full rounded-lg border border-line bg-paper px-3 py-2 text-base"
          />
        </div>
        <button type="submit" className={primaryButton}>
          Search
        </button>
      </div>

      <button
        type="button"
        aria-expanded={panelOpen}
        aria-controls="filter-panel"
        onClick={() => setPanelOpen((open) => !open)}
        className="mt-3 text-sm font-medium text-brand underline md:hidden"
      >
        {panelOpen ? "Hide filters" : "Show filters"}
      </button>

      <div id="filter-panel" className={`${panelOpen ? "block" : "hidden"} md:block`}>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SelectField id="audience" label="Suitable for" value={draft.audience} onChange={onChange}>
            <option value="">All</option>
            {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField id="condition" label="Condition" value={draft.condition} onChange={onChange}>
            <option value="">Any</option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <FormField
            id="min"
            label="Min price (₹)"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={draft.min}
            onChange={onChange}
          />
          <FormField
            id="max"
            label="Max price (₹)"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={draft.max}
            onChange={onChange}
          />
        </div>
        {priceError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {priceError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={primaryButton}>
            Apply filters
          </button>
          {canClear && (
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-line px-4 py-2 font-medium hover:bg-paper"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </form>
  );
}