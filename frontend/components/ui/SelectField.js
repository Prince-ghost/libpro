export default function SelectField({ id, label, children, ...selectProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
        {...selectProps}
      >
        {children}
      </select>
    </div>
  );
}