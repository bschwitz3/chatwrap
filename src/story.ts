// @ts-nocheck
// Story UI: each stat is a chat. Ported from the 2026-11-18 prototype.
import "./story.css";
export const BRAND = "Chatwrap";
let onKey = null, onHash = null;
const longDate = s => new Date(s + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const shortDate = s => new Date(s + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function mountStory(root, D, opts) {
if (onKey) document.removeEventListener("keydown", onKey);
if (onHash) window.removeEventListener("hashchange", onHash);
root.innerHTML = `
<div class="app">
  <aside class="side">
    <div class="side-head">
      <h1>${BRAND}</h1>
      <p id="period"></p>
      <div class="side-actions"><button type="button" id="hide-btn">Hide people</button><button type="button" id="restart-btn">Load another</button></div>
    </div>
    <div class="progress" aria-hidden="true"><i id="prog"></i></div>
    <nav class="list" id="list" aria-label="Stats"></nav>
  </aside>
  <main class="main">
    <header class="head" id="head"></header>
    <section class="thread" id="thread" aria-live="polite"><div class="stack" id="stack"></div></section>
    <footer class="foot">
      <button id="prev" type="button" aria-label="Previous stat">← Back</button>
      <div class="hint" id="hint">Press → or Space for the next stat</div>
      <button id="next" class="go" type="button">Next →</button>
    </footer>
  </main>
</div>
<dialog id="hide-dlg" aria-labelledby="hide-title">
  <form method="dialog" id="hide-form">
    <h2 id="hide-title">Hide people</h2>
    <p>Checked people disappear from every stat. Useful before you share a screenshot.</p>
    <div class="hide-list" id="hide-list"></div>
    <div class="dlg-actions"><button value="cancel" type="submit">Cancel</button><button value="ok" class="go" type="submit">Apply</button></div>
  </form>
</dialog>`;

const ME = "You";
const fmt = n => n.toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const disp = n => n === "?" ? "Unknown numbers" : n;
const mins = m => m < 1 ? Math.round(m * 60) + " s" : m < 60 ? (m < 10 ? m.toFixed(1).replace(".0", "") : Math.round(m)) + " min" : Math.floor(m / 60) + " h " + String(Math.round(m % 60)).padStart(2, "0");
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monLabel = ym => MON[+ym.slice(5) - 1];
const HUES = ["#25d366","#53bdeb","#ffd279","#ff7a7a","#c792ea","#ff9e64","#7ee0c3","#f78fb3","#a3be8c","#d8dee9"];

function hashColor(s) { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) % 360; return `hsl(${h} 55% 68%)`; }
function initials(n) { const w = n.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/); return ((w[0] || "?")[0] + (w[1] ? w[1][0] : "")).toUpperCase(); }
const ICONS = {
  spark: '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" fill="currentColor"/>',
  people: '<circle cx="9" cy="8" r="3.5" fill="currentColor"/><circle cx="17" cy="9" r="2.6" fill="currentColor" opacity=".7"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5z" fill="currentColor"/><path d="M15.5 14.6c2.8-.3 5.2 1.3 6 4.4h-4.6" fill="currentColor" opacity=".7"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  reply: '<path d="M10 8V4L3 11l7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" fill="currentColor"/>',
  wave: '<path d="M3 12h3l2-5 3 10 3-14 3 13 2-4h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>',
  chart: '<path d="M3 20h18M5 16l4-5 4 3 6-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  updown: '<path d="M7 20V5M7 5l-4 4M7 5l4 4M17 4v15M17 19l-4-4M17 19l4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0014 0M12 18v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="2"/>',
  quote: '<path d="M4 18v-5c0-4 2-6.5 6-7v3c-2 .5-3 2-3 4h3v5zm10 0v-5c0-4 2-6.5 6-7v3c-2 .5-3 2-3 4h3v5z" fill="currentColor"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z" fill="currentColor"/><circle cx="7.5" cy="8" r="1.6" fill="#2a3942"/>',
  group: '<circle cx="12" cy="7.5" r="3.2" fill="currentColor"/><circle cx="5" cy="10" r="2.4" fill="currentColor" opacity=".7"/><circle cx="19" cy="10" r="2.4" fill="currentColor" opacity=".7"/><path d="M6 20c.5-4 3-6 6-6s5.5 2 6 6z" fill="currentColor"/>',
  flag: '<path d="M5 22V3M5 4h12l-2.5 4L17 12H5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  hand: '<path d="M12 4a7.5 7.5 0 100 15c-.7 1.3-1.8 2.2-3 3 3 0 5.4-1 7-3a7.5 7.5 0 00-4-15z" fill="currentColor"/>'
};
function av(name, s = 40) {
  if (name === ME) return `<span class="av" style="--s:${s}px;background:var(--green);font-size:${Math.round(s * .3)}px">You</span>`;
  const p = D.pics[name];
  if (p) return `<img class="av" style="--s:${s}px" src="${p}" alt="">`;
  if (name === "?") return `<span class="av" style="--s:${s}px;background:#3b4a54;color:var(--ink)">?</span>`;
  return `<span class="av" style="--s:${s}px;background:${hashColor(name)}">${esc(initials(name))}</span>`;
}
function iconAv(k, s = 49) { return `<span class="av icon" style="--s:${s}px"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg></span>`; }

// ---------- bubble builders ----------
const T = (html, o = {}) => ({ html, ...o });
const txt = (s, o) => T(`<p>${s}</p>`, o);
const out = s => T(`<p>${s}</p>`, { out: true });
const big = (n, cap, o = {}) => T(`<div class="big ${o.white ? "w" : ""}">${n}</div><p class="cap">${cap}</p>`);
function rows(items, opt = {}) {
  const max = Math.max(...items.map(i => i.max ?? i.value));
  return `<div class="rows">${items.map((it, i) => `
    <div class="row ${i === 0 ? "top" : ""}">
      <span class="n">${i + 1}</span>${av(it.name, 36)}
      <span class="nm"><b>${esc(disp(it.name))}</b>${it.bar ?? `<span class="bar"><i class="me" style="width:${(100 * it.value / max).toFixed(1)}%"></i></span>`}</span>
      <span class="v">${it.label ?? fmt(it.value)}${it.sub ? `<small>${it.sub}</small>` : ""}</span>
    </div>`).join("")}</div>`;
}
function splitBar(mine, theirs, max) {
  const w = (mine + theirs) / max * 100;
  return `<span class="bar" style="width:${w.toFixed(1)}%"><i class="me" style="width:${(100 * mine / (mine + theirs)).toFixed(1)}%"></i><i class="th" style="flex:1"></i></span>`;
}
function chips(list, scale = true) {
  const mx = Math.max(...list.map(x => x.count)), mn = Math.min(...list.map(x => x.count));
  return `<div class="chips">${list.map(x => {
    const f = scale ? 14 + 16 * (x.count - mn) / Math.max(1, mx - mn) : 15;
    return `<span class="chip"><b style="font-size:${f.toFixed(0)}px">${esc(x.term)}</b><small>${fmt(x.count)}</small></span>`;
  }).join("")}</div>`;
}

// ---------- chats ----------
const S = D.speed, tot = D.totals;
const days = 365;
const TOP = D.top.slice(0, 20);
const chats = [];
const safe = f => { try { f(); } catch (e) { console.warn("skipped a stat:", e); } };

safe(() => chats.push({ id: "hello", title: BRAND, icon: iconAv("spark"), preview: "Your year in messages", status: `${longDate(D.period.start)} → ${longDate(D.period.end)}`, day: "One year",
  bubbles: () => [
    txt("Hey 👋"),
    txt(`I went through your last 12 months of WhatsApp, from ${longDate(D.period.start)} to ${longDate(D.period.end)}. Right here in your browser.`),
    big(fmt(tot.messages), `messages in your chats. You wrote <b>${fmt(tot.sent)}</b> of them, about <b>${Math.round(tot.sent / days)} a day</b>.`),
    T(`<div class="stats3"><div><b>${tot.dm_contacts}</b><span>people in 1:1 chats</span></div><div><b>${tot.groups}</b><span>active groups</span></div><div><b>${fmt(tot.voice_sent)}</b><span>voice notes sent</span></div></div>`, { wide: true }),
    txt(`Your busiest day was <b>${new Date(D.busiest.day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b>: ${fmt(D.busiest.count)} messages, ${fmt(D.busiest.chats[0][1])} of them with ${esc(D.busiest.chats[0][0])}.`),
    out("ok let's see this"),
    txt(`Press → to open the next chat. ${chats.length - 1} stats are waiting on the left.`),
  ] }));

safe(() => chats.push({ id: "top-20", title: "Your top 20", icon: iconAv("people"), preview: `#1 ${TOP[0].name}, ${fmt(TOP[0].total)} messages`, status: "1:1 chats only, no groups", day: "Top people",
  bubbles: () => {
    const mx = TOP[0].total;
    return [
      txt("Your 20 people, ranked by messages in 1:1 chats. Groups don't count here."),
      T(`<h3>Top 20 people</h3><div class="legend-mini"><span style="--c:var(--green)">you</span><span style="--c:#53bdeb">them</span></div>` +
        rows(TOP.map(p => ({ name: p.name, value: p.total, bar: splitBar(p.mine, p.theirs, mx), sub: `you ${Math.round(100 * p.mine / p.total)}%` }))), { wide: true }),
      txt(`<b>${esc(TOP[0].name)}</b> is number one with ${fmt(TOP[0].total)} messages. That's ${Math.round(TOP[0].total / days)} a day, every day of the year.`),
      (() => { const t = [...TOP].filter(p => p.total > 300).sort((a, b) => b.mine / b.total - a.mine / a.total)[0];
        return txt(`You carry the conversation most with <b>${esc(t.name)}</b>: ${Math.round(100 * t.mine / t.total)}% of the messages are yours.`); })(),
      out("not surprised by #1"),
    ];
  } }));

safe(() => chats.push({ id: "fastest", title: "Fastest replies", icon: iconAv("bolt"), preview: `${S.they_fast[0].name} replies in ${mins(S.they_fast[0].they)}`, status: "median reply time, both ways", day: "Reply speed",
  bubbles: () => [
    txt(`Reply speed. I used the median, ignored gaps over 24 h, and kept only people with 30+ replies. ${S.eligible - 1} people made the cut.`),
    T(`<div class="cols"><div><h4>They answer you fastest</h4>${rows(S.they_fast.map(p => ({ name: p.name, value: 1 / Math.max(p.they, .2), label: mins(p.they) })))}</div>` +
      `<div><h4>You answer them fastest</h4>${rows(S.me_fast.map(p => ({ name: p.name, value: 1 / Math.max(p.me, .2), label: mins(p.me) })))}</div></div>`, { wide: true }),
    T(`<div class="stats3" style="grid-template-columns:1fr 1fr"><div><b>${mins(S.their_median)}</b><span>people answer you, on median</span></div><div><b>${mins(S.my_median)}</b><span>you answer people, on median</span></div></div>`, { wide: true }),
    txt(`<b>${esc(S.they_fast[0].name)}</b> answers you in ${mins(S.they_fast[0].they)}. You answer <b>${esc(S.me_fast[0].name)}</b> in ${mins(S.me_fast[0].me)}.`),
    out("speed 🏎️"),
  ] }));

safe(() => chats.push({ id: "slowest", title: "Slowest replies", icon: iconAv("clock"), preview: `${S.they_slow[0].name} takes ${mins(S.they_slow[0].they)}`, status: "median reply time, both ways", day: "Reply speed",
  bubbles: () => {
    const youSlower = [...S.asym].filter(p => p.me > p.they).slice(0, 2);
    const theySlower = [...S.they_slow].filter(p => p.they > p.me).slice(0, 1);
    return [
      txt("Now the slow side. Same rules."),
      T(`<div class="cols"><div><h4>They take longest to answer you</h4>${rows(S.they_slow.slice(0, 10).map(p => ({ name: p.name, value: p.they, label: mins(p.they) })))}</div>` +
        `<div><h4>You take longest to answer them</h4>${rows(S.me_slow.slice(0, 10).map(p => ({ name: p.name, value: p.me, label: mins(p.me) })))}</div></div>`, { wide: true }),
      ...youSlower.map(p => txt(`<b>${esc(p.name)}</b> answers you in ${mins(p.they)}. You take ${mins(p.me)}.`)),
      ...theySlower.map(p => txt(`The other way: you answer <b>${esc(p.name)}</b> in ${mins(p.me)}, and wait ${mins(p.they)} for the reply.`)),
      out("ok I need to be faster with some people 😅"),
    ];
  } }));

safe(() => chats.push({ id: "night-owls", title: "Night owls", icon: iconAv("moon"), preview: `${D.night.top[0].name} after midnight`, status: "00:00 to 05:00", day: "After midnight",
  bubbles: () => [
    big(fmt(D.night.total), "messages in 1:1 chats between midnight and 5 a.m."),
    T(`<h3>Your night owls</h3>` + rows(D.night.top.map(p => ({ name: p.name, value: p.count }))), { wide: true }),
    txt(`<b>${esc(D.night.top[0].name)}</b> wins the night with ${D.night.top[0].count} messages after midnight.`),
    out("go to sleep guys"),
  ] }));

safe(() => chats.push({ id: "early-birds", title: "Early birds", icon: iconAv("sun"), preview: `${D.morning.top[0].name} before 9 a.m.`, status: "05:00 to 09:00", day: "Early morning",
  bubbles: () => [
    big(fmt(D.morning.total), "messages between 5 and 9 a.m. More mornings than nights."),
    T(`<h3>Your early birds</h3>` + rows(D.morning.top.map(p => ({ name: p.name, value: p.count }))), { wide: true }),
    txt(`<b>${esc(D.morning.top[0].name)}</b> is your morning person: ${D.morning.top[0].count} messages before 9 a.m.`),
  ] }));

safe(() => chats.push({ id: "year", title: "Your year, person by person", icon: iconAv("chart"), preview: "Top 10, month by month", status: "messages per month, top 10 people", day: "The year",
  bubbles: () => [
    txt("Your top 10 across the year. One line per person, messages per month. Click a name to focus on that line."),
    T(`<div class="chart" id="yearchart"></div>`, { wide: true, after: drawYear }),
    txt("The first and last months are partial, so both ends dip a little."),
  ] }));

safe(() => chats.push({ id: "rising-fading", title: "Rising and fading", icon: iconAv("updown"), preview: `${D.rising[0].name} is new and rising`, status: `${monLabel(D.trend_windows.early[0])}–${monLabel(D.trend_windows.early[2])} vs ${monLabel(D.trend_windows.late[0])}–${monLabel(D.trend_windows.late[2])}`, day: "Change",
  bubbles: () => {
    const w = D.trend_windows, a = `${monLabel(w.early[0])}–${monLabel(w.early[2])}`, b = `${monLabel(w.late[0])}–${monLabel(w.late[2])}`;
    const r = p => ({ name: p.name, value: Math.abs(p.delta), label: `${fmt(p.early)} → ${fmt(p.late)}`, sub: (p.delta > 0 ? "+" : "−") + fmt(Math.abs(p.delta)) });
    return [
      txt(`I compared your first 3 full months (${a}) with your last 3 (${b}).`),
      T(`<div class="cols"><div><h4>Rising</h4>${rows(D.rising.map(r))}</div><div><h4>Fading</h4>${rows(D.fading.map(r))}</div></div>`, { wide: true }),
      txt(`<b>${esc(D.rising[0].name)}</b> went from ${D.rising[0].early} to ${D.rising[0].late} messages. New this year.`),
      txt(`<b>${esc(D.fading[0].name)}</b>: ${fmt(D.fading[0].early)} messages in ${a}, ${fmt(D.fading[0].late)} in ${b}.`),
    ];
  } }));

safe(() => chats.push({ id: "voice-notes", title: "Voice notes", icon: iconAv("mic"), preview: `${D.voice.recv[0].name} sends you the most`, status: "1:1 chats", day: "Voice",
  bubbles: () => [
    T(`<div class="stats3" style="grid-template-columns:1fr 1fr"><div><b>${fmt(D.voice.sent_total)}</b><span>voice notes you sent</span></div><div><b>${fmt(D.voice.recv_total)}</b><span>voice notes you received</span></div></div>`, { wide: true }),
    txt(`You receive ${(D.voice.recv_total / D.voice.sent_total).toFixed(1)}× more voice notes than you send.`),
    T(`<div class="cols"><div><h4>You voice them most</h4>${rows(D.voice.sent.map(p => ({ name: p.name, value: p.count })))}</div><div><h4>They voice you most</h4>${rows(D.voice.recv.map(p => ({ name: p.name, value: p.count })))}</div></div>`, { wide: true }),
    (() => { const pairs = D.voice.recv.map(r => ({ r, s: D.voice.sent.find(x => x.name === r.name) })).filter(p => p.s).sort((a, b) => b.r.count / b.s.count - a.r.count / a.s.count);
      const p = pairs[0];
      return p ? txt(`<b>${esc(p.r.name)}</b> sent you ${p.r.count} voice notes. You sent back ${p.s.count}.`) : txt(`<b>${esc(D.voice.recv[0].name)}</b> sent you ${D.voice.recv[0].count}.`); })(),
    out("🎙️ listening at 2× speed"),
  ] }));

safe(() => chats.push({ id: "languages", title: "Your languages", icon: iconAv("globe"), preview: `${Math.round(D.language.mix[0].pct)}% French`, status: "your own messages", day: "Language",
  bubbles: () => {
    const c = { French: "#53bdeb", English: "#ffd279", German: "#ff7a7a", Italian: "#7ee0c3", Spanish: "#c792ea", "Swiss German": "#ff9e64" };
    const minFr = Math.min(...D.language.per_contact.map(p => p.mix.French || 0));
    return [
      big(Math.round(D.language.mix[0].pct) + "%", "of your messages are in French. No big surprise."),
      T(`<div class="langbar">${D.language.mix.map(l => `<i style="width:${l.pct}%;background:${c[l.lang] || "#8696a0"}">${l.pct >= 4 ? l.lang + " " + Math.round(l.pct) + "%" : ""}</i>`).join("")}</div>` +
        `<div class="legend-mini">${D.language.mix.map(l => `<span style="--c:${c[l.lang] || "#8696a0"}">${l.lang} ${l.pct}%</span>`).join("")}</div>` +
        `<p class="cap">Based on ${fmt(D.language.classified)} of your messages long enough to tell. Detected on your Mac, nothing sent anywhere.</p>`, { wide: true }),
      txt(`English is ${D.language.mix[1].pct}%. With your top 10 people, French never drops below ${minFr}%.`),
    ];
  } }));

safe(() => chats.push({ id: "your-words", title: "Your top 20 words", icon: iconAv("quote"), preview: `${D.my_top[0].term} ×${fmt(D.my_top[0].count)}`, status: "your messages, filler words removed", day: "Vocabulary",
  bubbles: () => {
    const ptn = D.my_top.find(x => x.term === "ptn");
    return [
      txt("Your most used words, short phrases and emojis. I removed filler like « le », « de », « et »."),
      T(`<h3>Your top 20</h3>` + chips(D.my_top), { wide: true }),
      big(D.my_top[0].term + " ×" + fmt(D.my_top[0].count), `That's ${(D.my_top[0].count / days).toFixed(1)} per day.`, { white: true }),
      ptn ? txt(`And « ptn » ${fmt(ptn.count)} times. Some days are harder than others.`) : txt(""),
      out("🤣"),
    ];
  } }));

safe(() => chats.push({ id: "signature-words", title: "Signature words", icon: iconAv("tag"), preview: "Your word with each close person", status: "the word that's most yours together", day: "Vocabulary",
  bubbles: () => [
    txt("For your 10 closest people: the word that's most typical of each chat. Yours on the left, theirs on the right."),
    T(`<div class="rows">${D.close.map((c, i) => `
      <div class="row" style="grid-template-columns:26px 36px minmax(0,1fr) auto auto">
        <span class="n">${i + 1}</span>${av(c.name, 36)}<span class="nm"><b>${esc(c.name)}</b></span>
        <span class="chip" style="background:#005c4b"><b>${c.mine ? esc(c.mine.term) : "–"}</b><small>${c.mine ? c.mine.count : ""}</small></span>
        <span class="chip"><b>${c.theirs ? esc(c.theirs.term) : "–"}</b><small>${c.theirs ? c.theirs.count : ""}</small></span>
      </div>`).join("")}</div>`, { wide: true }),
    (() => { const a = D.close.find(c => c.mine && c.theirs && c.mine.term === c.theirs.term);
      return a ? txt(`With <b>${esc(a.name)}</b> you even share the same word: « ${esc(a.mine.term)} ».`) : txt("No two of you share the same signature word."); })(),
  ] }));

safe(() => chats.push({ id: "top-groups", title: "Your top groups", icon: iconAv("group"), preview: `#1 ${D.groups_top[0].name}`, status: "by total messages", day: "Groups",
  bubbles: () => {
    const g = D.groups_top, mx = g[0].total;
    return [
      txt(`Now the groups. ${tot.groups} groups had activity this year, with ${fmt(tot.group_messages)} messages.`),
      T(`<h3>Most active groups</h3><div class="legend-mini"><span style="--c:var(--green)">you</span><span style="--c:#53bdeb">everyone else</span></div>` +
        rows(g.map(x => ({ name: x.name, value: x.total, bar: splitBar(x.mine, x.total - x.mine, mx), sub: `you ${Math.round(100 * x.mine / x.total)}%` }))), { wide: true }),
      (() => { const q = g.find(x => x.mine === 0); return q ? txt(`In <b>${esc(q.name)}</b> you read ${fmt(q.total)} messages and wrote zero. Silent member.`) : txt(""); })(),
      txt("Next: inside your top 5 groups."),
    ];
  } }));

D.groups.forEach((g, gi) => {
  safe(() => chats.push({ id: "group-" + (gi + 1), title: g.name, icon: av(g.name, 49), preview: `${fmt(g.total)} messages, ${g.members} members active`, status: `group #${gi + 1} · ${g.members} active members`, day: "Group #" + (gi + 1),
    bubbles: () => {
      const lb = g.leaderboard, mx = lb[0]?.count || 1;
      const award = (label, a, unit) => a ? `<div class="award">${av(a[0], 40)}<div><span>${label}</span><b>${esc(disp(a[0]))}</b><small>${a[1]} ${unit}</small></div></div>` : "";
      const months = D.period.months, mmax = Math.max(...g.monthly);
      const spark = `<svg viewBox="0 0 ${months.length * 30} 90" role="img" aria-label="Messages per month">${g.monthly.map((v, i) => `<rect x="${i * 30 + 4}" y="${70 - 60 * v / mmax}" width="22" height="${Math.max(1, 60 * v / mmax)}" rx="3" fill="${v === mmax ? "#25d366" : "#53bdeb"}" opacity="${v === mmax ? 1 : .55}"/><text x="${i * 30 + 15}" y="86" text-anchor="middle">${monLabel(months[i])}</text>`).join("")}</svg>`;
      const peak = months[g.monthly.indexOf(mmax)];
      const rankTxt = g.my_rank ? (g.my_rank === 1 ? "You are the most active member. The group lives through you." : `You rank #${g.my_rank} of ${g.members} with ${fmt(g.mine)} messages (${Math.round(100 * g.mine / g.total)}%).`) : `You never wrote here. ${fmt(g.total)} messages read, zero sent.`;
      return [
        T(`<div style="display:flex;gap:14px;align-items:center">${av(g.name, 64)}<div><h3 style="margin:0">${esc(g.name)}</h3><p class="cap">${fmt(g.total)} messages this year</p></div></div>`),
        T(`<h3>Leaderboard</h3>` + rows(lb.map(p => ({ name: p.name, value: p.count }))), { wide: true }),
        txt(rankTxt),
        T(`<h3>Awards</h3><div class="awards">${award("Starts conversations", g.starter, "times")}${award("Kills conversations", g.killer, "last words")}${award("Night owl", g.night_owl, "msgs after midnight")}${award("Voice note king", g.voice_king, "voice notes")}</div>`, { wide: true }),
        T(`<h3>Activity over the year</h3><div class="chart">${spark}</div><p class="cap">Peak month: ${MON[+peak.slice(5) - 1]} ${peak.slice(0, 4)}, ${fmt(mmax)} messages.</p>`, { wide: true }),
        T(`<h3>Group vocabulary</h3>` + chips(g.top_terms), { wide: true }),
      ];
    } }));
});

safe(() => chats.push({ id: "bye", title: "That's a wrap", icon: iconAv("flag"), preview: "See you next year", status: "end", day: "The end",
  bubbles: () => [
    txt("That's your year on WhatsApp."),
    T(`<div class="stats3"><div><b>${fmt(tot.messages)}</b><span>messages</span></div><div><b>${esc(TOP[0].name)}</b><span>your #1 person</span></div><div><b>${mins(S.my_median)}</b><span>your reply time</span></div></div>`, { wide: true }),
    txt(`Your top emoji: ${D.my_top[0].term}. Your top group: ${esc(D.groups_top[0].name)}. Your night owl: ${esc(D.night.top[0].name)}.`),
    txt("Everything was counted inside this browser tab. Nothing was uploaded, and closing the tab erases it."),
    out("see you next year 👋"),
  ] }));

// ---------- year chart ----------
function drawYear() {
  const el = document.getElementById("yearchart"); if (!el) return;
  const M = D.period.months, ser = D.series, W = 760, H = 330, L = 40, R = 14, Tp = 14, B = 30;
  const ymax = Math.ceil(Math.max(...ser.flatMap(s => s.data)) / 100) * 100;
  const x = i => L + i * (W - L - R) / (M.length - 1), y = v => Tp + (H - Tp - B) * (1 - v / ymax);
  let g = "";
  for (let v = 0; v <= ymax; v += ymax / 4) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ffffff14"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  M.forEach((m, i) => g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${monLabel(m)}${m.endsWith("-01") ? " " + m.slice(2, 4) : ""}</text>`);
  const lines = ser.map((s, k) => {
    const pts = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const li = s.data.length - 1;
    return `<g class="ln" data-k="${k}"><polyline points="${pts}" fill="none" stroke="${HUES[k]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${s.data.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === li ? 3.5 : 2}" fill="${HUES[k]}"><title>${esc(s.name)} · ${monLabel(M[i])} ${M[i].slice(0, 4)}: ${fmt(v)}</title></circle>`).join("")}</g>`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Messages per month for your top 10 people">${g}${lines}</svg>
    <div class="leg">${ser.map((s, k) => `<button type="button" data-k="${k}" aria-pressed="false">${av(s.name, 22)}<i style="background:${HUES[k]}"></i>${esc(s.name)}</button>`).join("")}</div>`;
  let focus = null;
  const apply = () => {
    el.querySelectorAll("g.ln").forEach(n => { const on = focus === null || +n.dataset.k === focus; n.style.opacity = on ? 1 : .1; n.querySelector("polyline").setAttribute("stroke-width", focus !== null && on ? 3.5 : 2.2); });
    el.querySelectorAll(".leg button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.k === focus)));
  };
  el.querySelectorAll(".leg button").forEach(b => {
    b.addEventListener("click", () => { focus = focus === +b.dataset.k ? null : +b.dataset.k; apply(); });
    b.addEventListener("mouseenter", () => { if (focus === null) { el.querySelectorAll("g.ln").forEach(n => n.style.opacity = +n.dataset.k === +b.dataset.k ? 1 : .12); } });
    b.addEventListener("mouseleave", apply);
  });
}

// ---------- shell ----------
const $ = id => document.getElementById(id);
const seen = new Set();
let cur = 0, timer = null;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
$("period").textContent = `${shortDate(D.period.start)} – ${shortDate(D.period.end)} · ${fmt(tot.messages)} messages`;

function renderList() {
  $("list").innerHTML = chats.map((c, i) => `
    <button class="item ${seen.has(i) ? "seen" : ""}" type="button" data-i="${i}" aria-current="${i === cur}">
      ${c.icon}
      <span class="t"><b>${esc(c.title)}</b><span>${esc(c.preview)}</span></span>
      <span class="m">${i + 1}/${chats.length}<span class="dot">1</span></span>
    </button>`).join("");
  $("list").querySelectorAll(".item").forEach(b => b.addEventListener("click", () => go(+b.dataset.i)));
}
function stamp(i) { const m = 9 * 60 + 41 + i; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
function bubbleEl(b, i, prevOut) {
  const d = document.createElement("div");
  d.className = "b" + (b.out ? " out" : "") + (b.wide ? " wide" : "") + (i === 0 || prevOut !== !!b.out ? " first" : "");
  d.innerHTML = b.html + `<span class="time">${stamp(i)}${b.out ? " ✓✓" : ""}</span>`;
  return d;
}
function go(i, animate = true) {
  if (i < 0 || i >= chats.length) return;
  clearTimeout(timer);
  cur = i; seen.add(i);
  const c = chats[i];
  if (location.hash.slice(1) !== c.id) history.replaceState(null, "", "#" + c.id);
  $("head").innerHTML = `${c.icon.replace(/--s:49px/g, "--s:40px")}<div class="who"><b>${esc(c.title)}</b><span>${esc(c.status)}</span></div><span class="step">${i + 1} / ${chats.length}</span>`;
  $("prev").disabled = i === 0;
  $("next").disabled = i === chats.length - 1;
  $("next").textContent = i === chats.length - 1 ? "Done" : "Next →";
  $("hint").textContent = i === chats.length - 1 ? "That's everything. Pick any chat on the left to revisit it." : `Next: ${chats[i + 1].title}`;
  $("prog").style.width = (100 * seen.size / chats.length) + "%";
  renderList();
  const stack = $("stack"); stack.innerHTML = `<div class="daychip">${esc(c.day)}</div>`;
  let list; try { list = c.bubbles().filter(b => b && b.html !== "<p></p>"); } catch (e) { console.warn(e); list = [txt("Not enough data for this one.")]; }
  const thread = $("thread"); thread.scrollTop = 0;
  if (!animate || reduced) { list.forEach((b, k) => { stack.appendChild(bubbleEl(b, k, k ? !!list[k - 1].out : null)); b.after && b.after(); }); return; }
  let k = 0;
  const step = () => {
    if (k >= list.length) return;
    const b = list[k];
    const ty = document.createElement("div"); ty.className = "typing"; ty.innerHTML = "<i></i><i></i><i></i>";
    if (b.out) ty.style.alignSelf = "flex-end", ty.style.background = "var(--out)";
    stack.appendChild(ty); thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
    timer = setTimeout(() => {
      ty.remove();
      const el = bubbleEl(b, k, k ? !!list[k - 1].out : null); el.classList.add("pop"); stack.appendChild(el);
      b.after && b.after();
      if (b.wide) thread.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" }); else thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
      k++; timer = setTimeout(step, b.wide ? 900 : 380);
    }, b.wide ? 450 : 520);
  };
  step();
}
$("next").addEventListener("click", () => go(cur + 1));
$("prev").addEventListener("click", () => go(cur - 1));
document.addEventListener("keydown", onKey = e => {
  if (!document.body.contains(root) || document.querySelector("dialog[open]")) return;
  if (e.target.closest && e.target.closest(".leg")) return;
  if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); go(cur + 1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(cur - 1); }
});
const fromHash = () => Math.max(0, chats.findIndex(c => c.id === location.hash.slice(1)));
window.addEventListener("hashchange", onHash = () => { const i = fromHash(); if (i !== cur) go(i); });
go(fromHash(), false);

// hide people
const allNames = [...new Set([...D.top.map(p => p.name), ...D.groups.flatMap(g => g.leaderboard.map(p => p.name)), ...(opts.hidden || [])])].filter(n => n !== ME && n !== "?");
$("hide-btn").addEventListener("click", () => {
  $("hide-list").innerHTML = allNames.map((n, i) => `<label for="h${i}">${av(n, 28)}<span>${esc(n)}</span><input type="checkbox" id="h${i}" value="${esc(n)}" ${opts.hidden?.has(n) ? "checked" : ""}></label>`).join("");
  $("hide-dlg").showModal();
});
$("hide-dlg").addEventListener("close", () => {
  if ($("hide-dlg").returnValue !== "ok") return;
  opts.onHide(new Set([...$("hide-list").querySelectorAll("input:checked")].map(i => i.value)));
});
$("restart-btn").addEventListener("click", () => opts.onRestart());
}
