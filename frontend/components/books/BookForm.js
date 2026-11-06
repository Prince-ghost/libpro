"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Alert from "@/components/ui/Alert";
import FormField from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import TextAreaField from "@/components/ui/TextAreaField";
import PhotoPicker from "@/components/books/PhotoPicker";
import { AUDIENCE_LABELS, CONDITION_LABELS } from "@/lib/format";
import { fieldErrorsFrom, focusFirstError } from "@/lib/form-errors";
import {
  CATEGORY_SUGGESTIONS,
  FIELD_ORDER,
  buildCreatePayload,
  buildPatch,
  photoFromId,
  validateValues,
  valuesFromBook,
} from "@/lib/book-form";

// One form for both creating (book is null) and editing (book is the existing listing).
export default function BookForm({ book = null, onSubmit, submitLabel, busyLabel, cancelHref, notice = "" }) {
  const pathname = usePathname();
  const [values, setValues] = useState(() => valuesFromBook(book));
  const [photos, setPhotos] = useState(() => (book?.images ?? []).map(photoFromId));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function onChange(event) {
    const { name, value } = event.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return; // ignore double clicks
    setFormError("");
    setExpired(false);

    const found = validateValues(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }
    if (photos.some((p) => p.status === "uploading")) {
      setFormError("Please wait for your photos to finish uploading.");
      return;
    }
    if (photos.some((p) => p.status === "error")) {
      setFormError("Remove the photos that failed to upload, then try again.");
      return;
    }

    const imageIds = photos.map((p) => p.id);
    const payload = book ? buildPatch(values, book, imageIds) : buildCreatePayload(values, imageIds);
    if (book && Object.keys(payload).length === 0) {
      setFormError("You have not changed anything yet.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload); // on success the parent moves to another page
    } catch (err) {
      if (err?.status === 401) {
        setExpired(true);
        setFormError("Your session has expired. Please log in again.");
      } else {
        const fields = fieldErrorsFrom(err);
        if (fields.priceMinor) {
          fields.price = fields.priceMinor; // the API calls the price priceMinor
          delete fields.priceMinor;
        }
        if (fields.imageKeys) {
          fields.photos = fields.imageKeys; // and the photos imageKeys
          delete fields.imageKeys;
        }
        setErrors(fields);
        setFormError(
          Object.keys(fields).length > 0
            ? "Please correct the highlighted fields."
            : err?.message ?? "Something went wrong. Please try again."
        );
        focusFirstError(fields, FIELD_ORDER);
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {notice && <Alert tone="info">{notice}</Alert>}
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

      <FormField
        id="title"
        label="Title"
        type="text"
        maxLength={200}
        value={values.title}
        onChange={onChange}
        error={errors.title}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="author"
          label="Author"
          type="text"
          maxLength={120}
          value={values.author}
          onChange={onChange}
          error={errors.author}
        />
        <FormField
          id="category"
          label="Category"
          type="text"
          maxLength={60}
          autoComplete="off"
          list="category-options"
          hint="For example Physics or Computer Science."
          value={values.category}
          onChange={onChange}
          error={errors.category}
        />
        <datalist id="category-options">
          {CATEGORY_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="audience" label="Suitable for" value={values.audience} onChange={onChange} error={errors.audience}>
          <option value="">Choose…</option>
          {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField id="condition" label="Condition" value={values.condition} onChange={onChange} error={errors.condition}>
          <option value="">Choose…</option>
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="classOrCourse"
          label="Class or course (optional)"
          type="text"
          maxLength={100}
          hint="For example Class 11 or B.Tech CSE, Sem 3."
          value={values.classOrCourse}
          onChange={onChange}
          error={errors.classOrCourse}
        />
        <FormField
          id="edition"
          label="Edition (optional)"
          type="text"
          maxLength={50}
          value={values.edition}
          onChange={onChange}
          error={errors.edition}
        />
      </div>

      <FormField
        id="price"
        label="Price (₹)"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        maxLength={12}
        hint="Between ₹0.01 and ₹1,00,000. For example 250 or 150.50."
        value={values.price}
        onChange={onChange}
        error={errors.price}
      />

      <TextAreaField
        id="description"
        label="Description (optional)"
        rows={5}
        maxLength={2000}
        hint={`${values.description.length} of 2000 characters. Mention marks, highlighting or missing pages.`}
        value={values.description}
        onChange={onChange}
        error={errors.description}
      />

      <PhotoPicker photos={photos} setPhotos={setPhotos} error={errors.photos} />

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? busyLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="rounded-lg border border-line px-6 py-2.5 font-medium hover:bg-paper">
          Cancel
        </Link>
      </div>
    </form>
  );
}