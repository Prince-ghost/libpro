// Turns the API's validation details ([{ field, issue }]) into { field: issue }.
export function fieldErrorsFrom(err) {
  const out = {};
  for (const d of err?.details ?? []) {
    if (d?.field && !out[d.field]) out[d.field] = d.issue;
  }
  return out;
}

// Moves the keyboard cursor to the first field that has a problem.
export function focusFirstError(errors, order) {
  const first = order.find((key) => errors[key]);
  if (first) document.getElementById(first)?.focus();
}