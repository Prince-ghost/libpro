export default function Alert({ tone = "error", children }) {
  const styles =
    tone === "error"
      ? "border-danger/30 bg-danger/5 text-danger"
      : "border-brand/30 bg-brand/5 text-brand-dark";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}