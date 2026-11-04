export default function SelectField({ id, label, error, children, ...selectProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1 block w-full rounded-lg border bg-surface px-3 py-2 text-base ${
          error ? "border-danger" : "border-line"
        }`}
        {...selectProps}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}