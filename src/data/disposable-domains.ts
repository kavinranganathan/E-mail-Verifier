// Seed list of disposable / temporary email domains.
// PLAN R4: this MUST become a scheduled-refresh dataset, not a static file.
// For v1 this seed proves the check; replace the loader with a refreshed source.

export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "getnada.com",
  "trashmail.com",
  "fakeinbox.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "mintemail.com",
  "mohmal.com",
]);
