export default function Loading() {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand"
      />
      <span>Loading…</span>
    </div>
  );
}