import { ResultCollector, stableSort, filterByFreshness, cleanRow, UserError, requireInput }
  from "./reliability.js";

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? (pass++, console.log("  ✓ " + name)) : (fail++, console.log("  ✗ " + name)); };

// --- hard limit ---
const c = new ResultCollector({ maxItems: 3, dedupeKey: "id" });
c.addMany([{id:1},{id:2},{id:3},{id:4},{id:5}]);
t("never exceeds maxItems", c.items.length === 3);
t("flags that the limit was hit", c.hitLimit === true);
t("isFull true at cap", c.isFull === true);
t("remaining is 0", c.remaining === 0);

// --- dedupe ---
const d = new ResultCollector({ maxItems: 10, dedupeKey: "id" });
d.addMany([{id:1},{id:1},{id:2},{id:1}]);
t("dedupes by key", d.items.length === 2);
t("counts duplicates", d.stats.duplicates === 2);

// --- missing dedupe key kept ---
const e = new ResultCollector({ maxItems: 10, dedupeKey: "id" });
e.addMany([{id:null,v:"a"},{id:null,v:"b"}]);
t("keeps rows with missing dedupe key", e.items.length === 2);

// --- deterministic sort ---
const rows = [
  {name:"b", date:"2026-01-02"}, {name:"a", date:"2026-01-03"},
  {name:"c", date:"2026-01-01"}, {name:"a", date:"2026-01-03"},
];
const s1 = stableSort(rows, { by:[{key:"date",desc:true}], tieBreakKey:"name" });
const s2 = stableSort([...rows].reverse(), { by:[{key:"date",desc:true}], tieBreakKey:"name" });
t("newest first", s1[0].date === "2026-01-03" && s1[3].date === "2026-01-01");
t("deterministic across input order", JSON.stringify(s1) === JSON.stringify(s2));

// --- nulls sort last both directions ---
const withNulls = [{d:null},{d:"2026-01-01"},{d:""}];
const asc = stableSort(withNulls, { by:["d"] });
const desc = stableSort(withNulls, { by:[{key:"d",desc:true}] });
t("nulls last ascending", asc[0].d === "2026-01-01");
t("nulls last descending", desc[0].d === "2026-01-01");

// --- freshness ---
const now = Date.now();
const items = [
  { t: new Date(now - 1*3600*1000).toISOString(), n:"1h" },
  { t: new Date(now - 48*3600*1000).toISOString(), n:"48h" },
  { t: "not-a-date", n:"undated" },
];
const fresh = filterByFreshness(items, { dateField:"t", maxAgeHours: 24 });
t("filters stale", fresh.find(x=>x.n==="48h") === undefined);
t("keeps fresh", !!fresh.find(x=>x.n==="1h"));
t("keeps undated", !!fresh.find(x=>x.n==="undated"));
t("no-op without config", filterByFreshness(items,{dateField:"t"}).length === 3);

// --- cleanRow ---
const cleaned = cleanRow({ a:"  x   y ", b:["p","q"], c:{k:1}, d:null, e:"", f:0 });
t("collapses whitespace", cleaned.a === "x y");
t("joins scalar arrays", cleaned.b === "p, q");
t("stringifies objects", cleaned.c === '{"k":1}');
t("drops null/empty", !("d" in cleaned) && !("e" in cleaned));
t("keeps zero", cleaned.f === 0);

// --- errors ---
try { requireInput({}, "startUrls"); t("requireInput throws", false); }
catch (err) { t("requireInput throws UserError", err instanceof UserError && err.message.includes("startUrls")); }
t("requireInput passes valid", requireInput({q:"hi"},"q") === "hi");
try { filterByFreshness([], {dateField:"t", since:"garbage"}); t("bad date throws", false); }
catch (err) { t("bad date throws UserError", err instanceof UserError); }

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
