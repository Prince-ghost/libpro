// Statuses are always written out in words, never shown by colour alone.
const WAITING = "border-amber-300 bg-amber-50 text-amber-900";
const GOOD = "border-brand/30 bg-brand/5 text-brand-dark";
const BAD = "border-danger/30 bg-danger/5 text-danger";

export const MODERATION = {
  pending: { label: "Waiting for approval", style: WAITING },
  approved: { label: "Approved", style: GOOD },
  rejected: { label: "Not approved", style: BAD },
};

export const USER_STATUS = {
  active: { label: "Active", style: GOOD },
  disabled: { label: "Disabled", style: BAD },
};

export const ROLE_LABELS = { user: "User", admin: "Admin" };

export const AUDIT_ACTIONS = {
  "book.moderate": "Listing moderated",
  "user.status": "Account status changed",
  "admin.grant": "Admin rights granted",
  "admin.revoke": "Admin rights removed",
};