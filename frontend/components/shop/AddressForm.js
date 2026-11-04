"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import FormField from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { fieldErrorsFrom, focusFirstError } from "@/lib/form-errors";
import {
  ADDRESS_FIELD_ORDER,
  INDIAN_STATES,
  buildAddressCreate,
  buildAddressPatch,
  validateAddress,
  valuesFromAddress,
} from "@/lib/address";

// One form for adding (address is null) and editing an address.
export default function AddressForm({
  address = null,
  canSetDefault = false,
  onSubmit,
  onCancel,
  submitLabel,
  busyLabel,
}) {
  const pathname = usePathname();
  const [values, setValues] = useState(() => valuesFromAddress(address));
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // An address saved earlier with a state that is not in the list still has to be selectable.
  const stateOptions = !values.state || INDIAN_STATES.includes(values.state) ? INDIAN_STATES : [values.state, ...INDIAN_STATES];

  function onChange(event) {
    const { name, value } = event.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    setExpired(false);

    const found = validateAddress(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, ADDRESS_FIELD_ORDER);
      return;
    }

    const payload = address ? buildAddressPatch(values, address, makeDefault) : buildAddressCreate(values, makeDefault);
    if (address && Object.keys(payload).length === 0) {
      setFormError("You have not changed anything yet.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload); // on success the parent closes this form
    } catch (err) {
      if (err?.status === 401) {
        setExpired(true);
        setFormError("Your session has expired. Please log in again.");
      } else {
        const fields = fieldErrorsFrom(err);
        setErrors(fields);
        setFormError(
          Object.keys(fields).length > 0
            ? "Please correct the highlighted fields."
            : err?.message ?? "Something went wrong. Please try again."
        );
        focusFirstError(fields, ADDRESS_FIELD_ORDER);
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {formError && (
        <Alert>
          {formError}
          {expired && (
            <>
              {" "}
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-medium underline">
                Log in
              </Link>
            </>
          )}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="recipientName"
          label="Full name"
          type="text"
          autoComplete="name"
          maxLength={80}
          value={values.recipientName}
          onChange={onChange}
          error={errors.recipientName}
        />
        <FormField
          id="phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={20}
          value={values.phone}
          onChange={onChange}
          error={errors.phone}
        />
      </div>

      <FormField
        id="line1"
        label="Address line 1"
        type="text"
        autoComplete="address-line1"
        maxLength={120}
        hint="House or flat number, street."
        value={values.line1}
        onChange={onChange}
        error={errors.line1}
      />
      <FormField
        id="line2"
        label="Address line 2 (optional)"
        type="text"
        autoComplete="address-line2"
        maxLength={120}
        hint="Area, landmark."
        value={values.line2}
        onChange={onChange}
        error={errors.line2}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="city"
          label="City or town"
          type="text"
          autoComplete="address-level2"
          maxLength={60}
          value={values.city}
          onChange={onChange}
          error={errors.city}
        />
        <SelectField
          id="state"
          label="State"
          autoComplete="address-level1"
          value={values.state}
          onChange={onChange}
          error={errors.state}
        >
          <option value="">Choose…</option>
          {stateOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <FormField
          id="postalCode"
          label="PIN code"
          type="text"
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={6}
          value={values.postalCode}
          onChange={onChange}
          error={errors.postalCode}
        />
      </div>

      <p className="text-sm text-muted">Delivery is within India for now.</p>

      {canSetDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(event) => setMakeDefault(event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Make this my default address
        </label>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-line px-6 py-2.5 font-medium hover:bg-paper disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}