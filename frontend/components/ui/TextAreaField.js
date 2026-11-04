export default function TextAreaField({ id, label, error, hint, ...textareaProps }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={`mt-1 block w-full rounded-lg border bg-surface px-3 py-2 text-base ${
          error ? "border-danger" : "border-line"
        }`}
        {...textareaProps}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}