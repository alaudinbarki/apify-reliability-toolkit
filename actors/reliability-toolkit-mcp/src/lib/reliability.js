// The reliability layer.
//
// Every complaint in the research about popular Actors was one of four things:
// limits ignored (surprise bills), stale data, non-deterministic output, and
// duplicate rows. This module fixes all four, so every Actor built from this
// template ships with the differentiator already in place.
//
// See ../../../05-gaps-research.md → Finding #2.

/**
 * Enforces a hard item cap and deduplicates before anything is pushed.
 *
 * This is the single most important class here. Users configure a limit and
 * expect it to be respected — the top complaint about the biggest scrapers is
 * that they blow past it and generate a bill the user never agreed to.
 */
export class ResultCollector {
  constructor({ maxItems = Infinity, dedupeKey = null } = {}) {
    this.maxItems = maxItems === null || maxItems === undefined ? Infinity : maxItems;
    this.dedupeKey = dedupeKey;
    this.items = [];
    this.seen = new Set();
    this.stats = { accepted: 0, duplicates: 0, rejectedOverLimit: 0, filtered: 0 };
    // True once the cap actually stopped us taking something the user's config
    // would otherwise have included — worth surfacing in the run log.
    this.hitLimit = false;
  }

  /** True once the cap is reached — check this to stop crawling early. */
  get isFull() {
    return this.items.length >= this.maxItems;
  }

  get remaining() {
    return Math.max(0, this.maxItems - this.items.length);
  }

  /**
   * Returns true if the item was accepted. Never exceeds maxItems, and never
   * stores a duplicate.
   */
  add(item) {
    if (this.isFull) {
      this.stats.rejectedOverLimit++;
      this.hitLimit = true;
      return false;
    }
    if (this.dedupeKey) {
      const key = item?.[this.dedupeKey];
      // A missing dedupe key means we can't judge — keep it rather than
      // silently dropping data the user asked for.
      if (key != null) {
        if (this.seen.has(key)) {
          this.stats.duplicates++;
          return false;
        }
        this.seen.add(key);
      }
    }
    this.items.push(item);
    this.stats.accepted++;
    return true;
  }

  /**
   * Adds a batch, stopping as soon as the cap is reached. Stops early rather
   * than walking the rest of the batch — the point of a limit is to do less work.
   */
  addMany(items) {
    for (const item of items) {
      if (this.isFull) {
        this.hitLimit = true;
        break;
      }
      this.add(item);
    }
    return this.items.length;
  }
}

/**
 * Deterministic ordering. Same input must produce the same output — otherwise
 * the Actor can't be used in a production pipeline at all.
 *
 * Sorts by the given fields, then always tie-breaks on a stable key so two runs
 * over the same data never disagree.
 */
export function stableSort(items, { by = [], tieBreakKey = null } = {}) {
  const fields = by.map((f) =>
    typeof f === "string" ? { key: f, desc: false } : f
  );

  return [...items].sort((a, b) => {
    for (const { key, desc } of fields) {
      const av = a?.[key];
      const bv = b?.[key];

      // Emptiness is resolved BEFORE the desc negation, so missing data always
      // sinks to the bottom — never floats to the top of a "newest first" list.
      const aEmpty = isEmpty(av);
      const bEmpty = isEmpty(bv);
      if (aEmpty && bEmpty) continue;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      const cmp = compareValues(av, bv);
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    if (tieBreakKey) {
      const av = a?.[tieBreakKey];
      const bv = b?.[tieBreakKey];
      if (isEmpty(av) && isEmpty(bv)) return 0;
      if (isEmpty(av)) return 1;
      if (isEmpty(bv)) return -1;
      return compareValues(av, bv);
    }
    return 0;
  });
}

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;

  const aDate = Date.parse(a);
  const bDate = Date.parse(b);
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) return aDate - bDate;

  return String(a).localeCompare(String(b));
}

/**
 * Freshness filter. "Returned yesterday's posts and missed the last hour" was a
 * direct complaint about a major scraper — for time-sensitive work that makes
 * the data useless.
 */
export function filterByFreshness(items, { dateField, maxAgeHours = null, since = null }) {
  if (!dateField || (maxAgeHours == null && since == null)) return items;

  const cutoff = since
    ? Date.parse(since)
    : Date.now() - maxAgeHours * 3600 * 1000;

  if (Number.isNaN(cutoff)) {
    throw new UserError(`Could not read the date "${since}". Use a format like 2026-08-27.`);
  }

  return items.filter((item) => {
    const t = Date.parse(item?.[dateField]);
    // Undated items are kept — dropping them silently loses real results.
    if (Number.isNaN(t)) return true;
    return t >= cutoff;
  });
}

/**
 * Flattens and cleans a row. Buyers export to CSV and Excel; deeply nested JSON
 * is a support ticket waiting to happen.
 */
export function cleanRow(obj, { dropEmpty = true } = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === undefined) continue;
    if (dropEmpty && (v === null || v === "")) continue;
    if (Array.isArray(v)) {
      out[k] = v.every((x) => typeof x !== "object" || x === null)
        ? v.join(", ")
        : JSON.stringify(v);
    } else if (typeof v === "object" && v !== null) {
      out[k] = JSON.stringify(v);
    } else if (typeof v === "string") {
      out[k] = v.replace(/\s+/g, " ").trim();
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * An error whose message is meant for the user, not the logs. Cryptic failures
 * are one of the documented reasons Actors get abandoned.
 */
export class UserError extends Error {
  constructor(message, hint = null) {
    super(hint ? `${message}\n\n→ ${hint}` : message);
    this.name = "UserError";
    this.isUserError = true;
  }
}

/** Validates input up front so users fail fast with a clear message. */
export function requireInput(input, field, { hint = null } = {}) {
  const v = input?.[field];
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) {
    throw new UserError(
      `Missing required input: "${field}".`,
      hint ?? `Set "${field}" in the input form and run again.`
    );
  }
  return v;
}
