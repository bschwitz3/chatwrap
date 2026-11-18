import type { Stats } from "./analyze";

// Remove hidden people from every list; awards held by them become empty.
export function hideNames(s: Stats, hidden: Set<string>): Stats {
  if (!hidden.size) return s;
  const walk = (o: unknown): unknown => {
    if (Array.isArray(o)) {
      if (o.length === 2 && typeof o[0] === "string" && typeof o[1] === "number") return hidden.has(o[0]) ? null : o;
      return o.map(walk).filter(x => x !== null && !(x && typeof x === "object" && "name" in x && hidden.has((x as { name: string }).name)));
    }
    if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "pics" ? v : walk(v)]));
    return o;
  };
  return walk(s) as Stats;
}
