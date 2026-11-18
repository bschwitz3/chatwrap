// Pure-logic stats over a WhatsApp Desktop (macOS) ChatStorage database. No network, no LLM.
import type { Database } from "sql.js";

export const ME = "You";
const APPLE_EPOCH = 978307200;
const CONTENT_TYPES = new Set([0, 1, 2, 3, 4, 5, 7, 8, 11, 13, 15, 46, 54]);
const VOICE = 3;
const BOTS = new Set(["Meta AI", "DHL"]);
const DAY = 86400000;

export type Named = { name: string; count: number };
export type Term = { term: string; count: number };
export type Speed = { name: string; they: number; me: number; n_they: number; n_me: number };
export type Group = {
  name: string; total: number; mine: number; members: number; my_rank: number | null;
  leaderboard: Named[]; starter: [string, number] | null; killer: [string, number] | null;
  night_owl: [string, number] | null; voice_king: [string, number] | null; monthly: number[]; top_terms: Term[];
};
export type Stats = {
  period: { start: string; end: string; months: string[] };
  totals: { messages: number; sent: number; dm_contacts: number; groups: number; dm_messages: number; group_messages: number; voice_sent: number };
  top: { name: string; total: number; mine: number; theirs: number }[];
  speed: { they_fast: Speed[]; me_fast: Speed[]; they_slow: Speed[]; me_slow: Speed[]; asym: Speed[]; my_median: number; their_median: number; eligible: number };
  night: { total: number; top: Named[] }; morning: { total: number; top: Named[] };
  series: { name: string; data: number[] }[];
  rising: Trend[]; fading: Trend[]; trend_windows: { early: string[]; late: string[] };
  voice: { sent_total: number; recv_total: number; sent: Named[]; recv: Named[] };
  my_top: Term[]; close: { name: string; mine: Term | null; theirs: Term | null }[];
  language: { classified: number; mix: { lang: string; pct: number }[]; per_contact: { name: string; mix: Record<string, number> }[] };
  busiest: { day: string; count: number; chats: [string, number][] };
  groups_top: { name: string; total: number; mine: number }[];
  groups: Group[];
  pics: Record<string, string>;
};
type Trend = { name: string; early: number; late: number; delta: number };
type Msg = { kind: "dm" | "group"; chat: string; me: boolean; t: Date; type: number; text: string; sender: string };

export type Inputs = { chat: Database; contacts: Database | null; pics: Map<string, Blob> };

function rows<T extends unknown[]>(db: Database, sql: string): T[] {
  const res = db.exec(sql);
  return res.length ? (res[0].values as unknown as T[]) : [];
}
const clean = (s: unknown) => String(s ?? "").replace(/[-]/g, "").trim();
const month = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const isoDay = (d: Date) => `${month(d)}-${String(d.getDate()).padStart(2, "0")}`;
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round1 = (x: number) => Math.round(x * 10) / 10;
class Counter<K> extends Map<K, number> {
  add(k: K, n = 1) { this.set(k, (this.get(k) ?? 0) + n); }
  top(n: number): [K, number][] { return [...this.entries()].sort((a, b) => b[1] - a[1]).slice(0, n); }
}

// ---------- text ----------
const STOP = new Set(`le la les l un une des de du d et ou a à au aux en dans sur pour par avec sans ce ces cet cette c ça ca cela
je j tu il elle on nous vous ils elles me m te t se s lui leur y ne n pas plus que qu qui quoi est es suis sont
ai as avons avez ont été être avoir fait faire mon ma mes ton ta tes son sa ses notre votre nos vos
mais donc car si oui non bah ben bon alors aussi très tout tous toute toutes comme même ici là
va vas vais moi toi quand peux peut était étais fais faut veux veut vient viens avait sera serait leurs ceux celle
après avant encore déjà juste genre ouais ok okay c'est j'ai t'es t'as qu'il qu'on n'est m'a d'un d'une s'il y'a ya
dit dis euh hein voilà enfin ah oh eh
the a an and or of to in on at for with is are was were be been it this that i you he she we they my your
so do does did not no yes but if just have has had will can get got im its it's i'm dont don't you're that's
there what when how why where who all from about out up one some
de da di il lo e è ein eine der die das und ich du ist nicht`.split(/\s+/));
const WORD = /[a-zà-ÿœæ']+|\p{Extended_Pictographic}/giu;
const EMOJI = /^\p{Extended_Pictographic}$/u;
const tokens = (t: string) => (t.toLowerCase().match(WORD) ?? []).map(w => w.replace(/^'+|'+$/g, "")).filter(Boolean);

const LANG: Record<string, Set<string>> = {
  French: new Set("je tu il elle on nous vous est suis pas les des une que qui avec pour mais oui c'est j'ai ça bien merci trop dans sur moi toi demain aujourd'hui".split(" ")),
  English: new Set("i you the is are not with for but yes it's i'm that this what have will just thanks good tomorrow today and".split(" ")),
  German: new Set("ich du ist nicht und das ein eine mit für aber ja danke gut morgen heute auch wie was".split(" ")),
  "Swiss German": new Set("isch nöd hesch gsi chunsch bisch mer öppis gseh vill guet".split(" ")),
  Italian: new Set("sono non che per con ma sì grazie bene domani oggi come cosa anche".split(" ")),
  Spanish: new Set("soy estoy que por con pero sí gracias bien mañana hoy como qué también".split(" ")),
  Portuguese: new Set("eu você não com para mas sim obrigado bem amanhã hoje como também está".split(" ")),
};
function langOf(text: string): string | null {
  const t = tokens(text);
  if (t.length < 3) return null;
  const sc = Object.entries(LANG).map(([l, ws]) => [l, t.filter(x => ws.has(x)).length] as const).sort((a, b) => b[1] - a[1]);
  if (!sc[0][1] || sc[0][1] === sc[1][1]) return null;
  return sc[0][0];
}
function topTerms(texts: string[], k: number): Term[] {
  const c = new Counter<string>();
  for (const t of texts) {
    const tk = tokens(t);
    for (const w of tk) if ((!STOP.has(w) && w.length > 1) || EMOJI.test(w)) c.add(w);
    for (const n of [2, 3]) for (let i = 0; i + n <= tk.length; i++) {
      const parts = tk.slice(i, i + n);
      if (parts.every(p => STOP.has(p)) || new Set(parts).size === 1) continue;
      c.add(parts.join(" "));
    }
  }
  const cand = c.top(400).filter(([w, n]) => !w.includes(" ") || n >= 8);
  const res: Term[] = [];
  for (const [w, n] of cand) {
    if (!w.includes(" ") && cand.some(([b, nb]) => b.includes(" ") && b.split(" ").includes(w) && nb >= 0.8 * n)) continue;
    res.push({ term: w, count: n });
    if (res.length === k) break;
  }
  return res;
}

export function analyze({ chat, contacts, pics }: Inputs): Stats {
  // ---- names ----
  const jidName = new Map<string, string>();
  for (const [name, jid] of rows<[string, string]>(chat, "select ZPARTNERNAME, ZCONTACTJID from ZWACHATSESSION where ZSESSIONTYPE=0"))
    if (clean(name) && jid) jidName.set(jid, clean(name));
  const push = new Map<string, string>();
  for (const [j, n] of rows<[string, string]>(chat, "select ZJID, ZPUSHNAME from ZWAPROFILEPUSHNAME")) if (j && clean(n)) push.set(j, clean(n));
  const book = new Map<string, [string | null, string]>();
  if (contacts) {
    try {
      for (const [wid, lid, full] of rows<[string | null, string | null, string | null]>(contacts, "select ZWHATSAPPID, ZLID, ZFULLNAME from ZWAADDRESSBOOKCONTACT"))
        for (const j of [wid, lid]) if (j) book.set(j, [wid, clean(full)]);
    } catch { /* older schema */ }
  }
  const memberName = (jid: string | null, fallback: string) => {
    if (!jid) return fallback || "?";
    if (jidName.has(jid)) return jidName.get(jid)!;
    const [wid, full] = book.get(jid) ?? [null, ""];
    if (wid && jidName.has(wid)) return jidName.get(wid)!;
    if (full) return full;
    return push.get(jid) || (wid ? push.get(wid) : undefined) || fallback || "?";
  };

  // ---- messages ----
  const raw = rows<[number, number, string, number, number, number, string | null, string | null, string | null, string | null]>(chat, `
    select m.ZCHATSESSION, c.ZSESSIONTYPE, c.ZPARTNERNAME, m.ZISFROMME, m.ZMESSAGEDATE, m.ZMESSAGETYPE, m.ZTEXT,
           nullif(g.ZCONTACTNAME, ''), g.ZMEMBERJID, c.ZCONTACTJID
    from ZWAMESSAGE m join ZWACHATSESSION c on c.Z_PK = m.ZCHATSESSION
    left join ZWAGROUPMEMBER g on g.Z_PK = m.ZGROUPMEMBER
    where c.ZSESSIONTYPE in (0, 1) and m.ZMESSAGEDATE is not null order by m.ZMESSAGEDATE`);
  let maxT = 0;
  for (const r of raw) if (CONTENT_TYPES.has(r[5])) maxT = Math.max(maxT, r[4]);
  const end = new Date((maxT + APPLE_EPOCH) * 1000);
  const start = new Date(end.getTime() - 365 * DAY);
  const msgs: Msg[] = [];
  const groupKey = new Map<number, string>();
  for (const [cid, st, partner, fromme, d, type, text, gname, gjid, cjid] of raw) {
    if (!CONTENT_TYPES.has(type)) continue;
    const t = new Date((d + APPLE_EPOCH) * 1000);
    if (t < start) continue;
    const pname = clean(partner) || "?";
    if (st === 0) {
      if (BOTS.has(pname) || (cjid ?? "").endsWith("@broadcast")) continue;
      msgs.push({ kind: "dm", chat: pname, me: !!fromme, t, type, text: text ?? "", sender: fromme ? ME : pname });
    } else {
      // two groups can share a name; key by id, display by name
      if (!groupKey.has(cid)) groupKey.set(cid, [...groupKey.values()].includes(pname) ? `${pname} (${cid})` : pname);
      msgs.push({ kind: "group", chat: groupKey.get(cid)!, me: !!fromme, t, type, text: text ?? "", sender: fromme ? ME : memberName(gjid, clean(gname)) });
    }
  }
  if (!msgs.length) throw new Error("No messages found in the last 12 months.");

  const by = (kind: Msg["kind"]) => { const m = new Map<string, Msg[]>(); for (const x of msgs) if (x.kind === kind) { if (!m.has(x.chat)) m.set(x.chat, []); m.get(x.chat)!.push(x); } return m; };
  const dms = by("dm"), groups = by("group");
  const months: string[] = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(month(d));

  // ---- 1:1 ----
  const dmStats = [...dms].map(([name, ms]) => { const mine = ms.filter(m => m.me).length; return { name, total: ms.length, mine, theirs: ms.length - mine }; }).sort((a, b) => b.total - a.total);
  const top = dmStats.slice(0, 25);
  const topNames = dmStats.slice(0, 10).map(d => d.name);

  const replies = (ms: Msg[]) => {
    const toMe: number[] = [], byMe: number[] = [];
    for (let i = 1; i < ms.length; i++) if (ms[i].me !== ms[i - 1].me) {
      const gap = (ms[i].t.getTime() - ms[i - 1].t.getTime()) / 60000;
      if (gap <= 1440) (ms[i].me ? byMe : toMe).push(gap);
    }
    return [toMe, byMe] as const;
  };
  const speed: Speed[] = []; const allMine: number[] = [], allTheirs: number[] = [];
  for (const [name, ms] of dms) {
    const [toMe, byMe] = replies(ms); allMine.push(...byMe); allTheirs.push(...toMe);
    if (toMe.length >= 30 && byMe.length >= 30) speed.push({ name, they: round1(median(toMe)), me: round1(median(byMe)), n_they: toMe.length, n_me: byMe.length });
  }
  const sortBy = (k: (s: Speed) => number) => [...speed].sort((a, b) => k(a) - k(b)).slice(0, 10);

  const bucket = (lo: number, hi: number) => {
    const c = new Counter<string>();
    for (const [name, ms] of dms) { const n = ms.filter(m => m.t.getHours() >= lo && m.t.getHours() < hi).length; if (n) c.set(name, n); }
    return { total: [...c.values()].reduce((a, b) => a + b, 0), top: c.top(10).map(([name, count]) => ({ name, count })) };
  };

  const series = topNames.map(name => { const c = new Counter<string>(); for (const m of dms.get(name)!) c.add(month(m.t)); return { name, data: months.map(mo => c.get(mo) ?? 0) }; });

  const full = months.length > 4 ? months.slice(1, -1) : months;
  const early = new Set(full.slice(0, 3)), late = new Set(full.slice(-3));
  const trend: Trend[] = [];
  for (const d of dmStats.slice(0, 60)) {
    const ms = dms.get(d.name)!;
    const e = ms.filter(m => early.has(month(m.t))).length, l = ms.filter(m => late.has(month(m.t))).length;
    if (e + l >= 60) trend.push({ name: d.name, early: e, late: l, delta: l - e });
  }

  const vS = new Counter<string>(), vR = new Counter<string>();
  for (const [name, ms] of dms) for (const m of ms) if (m.type === VOICE) (m.me ? vS : vR).add(name);

  // ---- words ----
  const textOnly = (ms: Msg[]) => ms.filter(m => m.type === 0 && m.text).map(m => m.text);
  const global = new Counter<string>(); let totalText = 0;
  for (const m of msgs) if (m.type === 0) { totalText++; for (const w of new Set(tokens(m.text))) if (!STOP.has(w)) global.add(w); }
  const signature = (texts: string[]): Term | null => {
    const c = new Counter<string>();
    for (const t of texts) for (const w of new Set(tokens(t))) if (!STOP.has(w) && w.length > 2) c.add(w);
    const n = Math.max(1, texts.length); let best: Term | null = null, score = 0;
    for (const [w, k] of c) { if (k < 5) continue; const lift = (k / n) / ((global.get(w) ?? 1) / Math.max(1, totalText)); const s = lift ** 0.6 * k; if (s > score) { score = s; best = { term: w, count: k }; } }
    return best;
  };
  const mineText = textOnly(msgs.filter(m => m.me));

  // ---- language ----
  const lc = new Counter<string>();
  for (const t of mineText) { const l = langOf(t); if (l) lc.add(l); }
  const ltot = [...lc.values()].reduce((a, b) => a + b, 0) || 1;
  const perContact = topNames.map(name => {
    const c = new Counter<string>(); for (const t of textOnly(dms.get(name)!.filter(m => m.me))) { const l = langOf(t); if (l) c.add(l); }
    const tot = [...c.values()].reduce((a, b) => a + b, 0);
    return { name, mix: Object.fromEntries(c.top(3).map(([k, v]) => [k, tot ? Math.round(100 * v / tot) : 0])) };
  }).filter(p => Object.keys(p.mix).length);

  // ---- busiest day ----
  const days = new Counter<string>(); for (const m of msgs) days.add(isoDay(m.t));
  const [bDay, bCount] = days.top(1)[0];
  const bChats = new Counter<string>(); for (const m of msgs) if (isoDay(m.t) === bDay) bChats.add(m.chat);

  // ---- groups ----
  const gStats = [...groups].map(([name, ms]) => ({ name, total: ms.length, mine: ms.filter(m => m.me).length })).sort((a, b) => b.total - a.total);
  const gOut: Group[] = gStats.slice(0, 5).map(g => {
    const ms = groups.get(g.name)!;
    const lead = new Counter<string>(), st = new Counter<string>(), kill = new Counter<string>(), nightG = new Counter<string>(), voiceG = new Counter<string>(), mc = new Counter<string>();
    ms.forEach((m, i) => {
      if (BOTS.has(m.sender)) return;
      lead.add(m.sender); mc.add(month(m.t));
      if (i === 0 || m.t.getTime() - ms[i - 1].t.getTime() > 6 * 3600000) st.add(m.sender);
      if (i < ms.length - 1 && ms[i + 1].t.getTime() - m.t.getTime() > 6 * 3600000) kill.add(m.sender);
      if (m.t.getHours() < 5) nightG.add(m.sender);
      if (m.type === VOICE) voiceG.add(m.sender);
    });
    const ranked = lead.top(1000).map(([n]) => n);
    const first = (c: Counter<string>) => (c.size ? c.top(1)[0] : null) as [string, number] | null;
    return {
      name: g.name, total: g.total, mine: g.mine, members: lead.size, my_rank: ranked.includes(ME) ? ranked.indexOf(ME) + 1 : null,
      leaderboard: lead.top(8).map(([name, count]) => ({ name, count })),
      starter: first(st), killer: first(kill), night_owl: first(nightG), voice_king: first(voiceG),
      monthly: months.map(mo => mc.get(mo) ?? 0), top_terms: topTerms(textOnly(ms), 5),
    };
  });

  // ---- profile pictures (blob URLs, never leave the page) ----
  const nameJids = new Map<string, Set<string>>();
  const addJ = (n: unknown, j: unknown) => { const k = clean(n); if (!k || !j) return; if (!nameJids.has(k)) nameJids.set(k, new Set()); nameJids.get(k)!.add(String(j)); };
  for (const [n, j] of rows<[string, string]>(chat, "select ZPARTNERNAME, ZCONTACTJID from ZWACHATSESSION where ZSESSIONTYPE in (0,1)")) addJ(n, j);
  for (const [n, j] of rows<[string, string]>(chat, "select coalesce(nullif(ZCONTACTNAME,''), ZFIRSTNAME), ZMEMBERJID from ZWAGROUPMEMBER")) addJ(n, j);
  for (const [j, wid] of book) { if (wid[0] && j !== wid[0]) for (const set of nameJids.values()) { if (set.has(wid[0])) set.add(j); else if (set.has(j)) set.add(wid[0]); } }
  // senders resolved via push name / address book
  for (const m of msgs) if (m.kind === "group" && !nameJids.has(m.sender)) for (const [j, full] of book) if (full[1] === m.sender) addJ(m.sender, j);
  for (const [j, n] of push) if (!nameJids.has(n)) addJ(n, j);
  // groups are keyed possibly with suffix; map display key -> jid
  for (const [cid, key] of groupKey) { const r = rows<[string]>(chat, `select ZCONTACTJID from ZWACHATSESSION where Z_PK=${Number(cid)}`); if (r[0]) addJ(key, r[0][0]); }
  const dbPic = new Map<string, string>();
  for (const [jid, path] of rows<[string, string]>(chat, "select ZJID, ZPATH from ZWAPROFILEPICTUREITEM where ZPATH like 'Media/%'")) dbPic.set(jid, path);
  const byPrefix = new Map<string, Blob>();
  for (const [p, b] of pics) { const base = p.split("/").pop()!; byPrefix.set(base.split("-")[0], b); }
  const picFor = (name: string): string | null => {
    for (const j of nameJids.get(name) ?? []) {
      const p = dbPic.get(j);
      if (p) for (const cand of [p, p + ".thumb", p + ".jpg"]) { const b = pics.get(cand); if (b) return URL.createObjectURL(b); }
    }
    for (const j of nameJids.get(name) ?? []) { const b = byPrefix.get(j.split("@")[0]); if (b) return URL.createObjectURL(b); }
    return null;
  };

  const out: Omit<Stats, "pics"> = {
    period: { start: isoDay(start), end: isoDay(end), months },
    totals: {
      messages: msgs.length, sent: msgs.filter(m => m.me).length, dm_contacts: dms.size, groups: groups.size,
      dm_messages: dmStats.reduce((a, b) => a + b.total, 0), group_messages: gStats.reduce((a, b) => a + b.total, 0),
      voice_sent: msgs.filter(m => m.me && m.type === VOICE).length,
    },
    top,
    speed: {
      they_fast: sortBy(s => s.they), me_fast: sortBy(s => s.me), they_slow: sortBy(s => -s.they), me_slow: sortBy(s => -s.me),
      asym: sortBy(s => -Math.abs(s.they - s.me)).slice(0, 5),
      my_median: round1(median(allMine)), their_median: round1(median(allTheirs)), eligible: speed.length,
    },
    night: bucket(0, 5), morning: bucket(5, 9), series,
    rising: [...trend].sort((a, b) => b.delta - a.delta).slice(0, 5).filter(t => t.delta > 0),
    fading: [...trend].sort((a, b) => a.delta - b.delta).slice(0, 5).filter(t => t.delta < 0),
    trend_windows: { early: [...early], late: [...late] },
    voice: { sent_total: [...vS.values()].reduce((a, b) => a + b, 0), recv_total: [...vR.values()].reduce((a, b) => a + b, 0), sent: vS.top(5).map(([name, count]) => ({ name, count })), recv: vR.top(5).map(([name, count]) => ({ name, count })) },
    my_top: topTerms(mineText, 20),
    close: topNames.map(name => ({ name, mine: signature(textOnly(dms.get(name)!.filter(m => m.me))), theirs: signature(textOnly(dms.get(name)!.filter(m => !m.me))) })),
    language: { classified: ltot, mix: lc.top(10).map(([lang, v]) => ({ lang, pct: round1(100 * v / ltot) })), per_contact: perContact },
    busiest: { day: bDay, count: bCount, chats: bChats.top(3) },
    groups_top: gStats.slice(0, 10),
    groups: gOut,
  };
  const names = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { if (o.length === 2 && typeof o[0] === "string" && typeof o[1] === "number") names.add(o[0]); o.forEach(walk); }
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "name" && typeof v === "string") names.add(v); else walk(v); }
  };
  walk(out);
  const picsOut: Record<string, string> = {};
  for (const n of names) { const p = picFor(n); if (p) picsOut[n] = p; }
  return { ...out, pics: picsOut };
}
