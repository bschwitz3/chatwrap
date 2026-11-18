// Short cinematic between picking the folder and the story. Real numbers, ~5 s, skippable.
import type { Stats } from "./analyze";

const el = () => {
  let n = document.getElementById("intro");
  if (!n) { n = document.createElement("div"); n.id = "intro"; n.setAttribute("role", "status"); n.setAttribute("aria-live", "polite"); document.body.appendChild(n); }
  return n;
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n: number) => n.toLocaleString("en-US");
const sleep = (ms: number, skip: Skip) => new Promise<void>(r => { if (skip.on) return r(); const t = setTimeout(r, ms); skip.wake = () => { clearTimeout(t); r(); }; });

type Skip = { on: boolean; wake?: () => void };

function drift(): string {
  let h = "";
  for (let i = 0; i < 14; i++) {
    const w = 80 + ((i * 53) % 140), left = (i * 71) % 100, dur = 9 + (i % 5) * 2.2, delay = -((i * 1.7) % 10);
    h += `<i class="${i % 3 === 0 ? "o" : ""}" style="left:${left}%;width:${w}px;animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
  }
  return `<div class="drift" aria-hidden="true">${h}</div>`;
}

export function showOpening(label: string): () => void {
  const n = el(); n.hidden = false; n.classList.remove("out");
  n.innerHTML = `${drift()}<div class="scene"><div class="pulse" aria-hidden="true"></div><p class="lbl">Opening ${label}…</p></div>`;
  return () => { n.hidden = true; n.innerHTML = ""; };
}

function hashColor(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)!) % 360; return `hsl(${h} 55% 68%)`; }
function face(name: string, pics: Record<string, string>, delay: number) {
  const p = pics[name], d = `animation-delay:${delay}s`;
  if (p) return `<img src="${p}" alt="" style="${d}">`;
  const w = name.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/);
  return `<span style="${d};background:${hashColor(name)}">${((w[0] || "?")[0] + (w[1]?.[0] ?? "")).toUpperCase()}</span>`;
}

export async function playIntro(s: Stats): Promise<void> {
  if (reduced()) return;
  const n = el(); n.hidden = false;
  const skip: Skip = { on: false };
  n.innerHTML = `${drift()}<div class="scene" id="scene"></div><button type="button" class="skip" id="skip">Skip</button>`;
  const scene = n.querySelector<HTMLElement>("#scene")!;
  const done = () => { skip.on = true; skip.wake?.(); };
  n.querySelector("#skip")!.addEventListener("click", done);
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") done(); };
  document.addEventListener("keydown", onKey);

  // 1. message counter
  scene.innerHTML = `<p class="lbl fade">In the last 12 months, you exchanged</p><div class="num g" id="num">0</div><p class="lbl fade" style="animation-delay:.3s">messages</p>`;
  const num = scene.querySelector<HTMLElement>("#num")!;
  const t0 = performance.now(), dur = 1600;
  await new Promise<void>(r => {
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      num.textContent = fmt(Math.round(s.totals.messages * e));
      if (k < 1 && !skip.on) requestAnimationFrame(tick); else { num.textContent = fmt(s.totals.messages); r(); }
    };
    requestAnimationFrame(tick);
  });
  await sleep(900, skip);

  // 2. people and groups
  if (!skip.on) {
    scene.innerHTML = `<p class="line fade">with <b>${fmt(s.totals.dm_contacts)} people</b></p><p class="line fade" style="animation-delay:.5s">and in <b>${fmt(s.totals.groups)} groups</b>.</p>`;
    await sleep(1900, skip);
  }

  // 3. faces
  if (!skip.on) {
    const top = s.top.slice(0, 5);
    scene.innerHTML = `<p class="line fade">But a few people stood out.</p><div class="faces">${top.map((p, i) => face(p.name, s.pics, 0.25 + i * 0.12)).join("")}</div>`;
    await sleep(2100, skip);
  }

  // 4. title
  if (!skip.on) {
    scene.innerHTML = `<div class="num fade" style="font-size:clamp(56px,9vw,120px)">Your year<br>in <span style="color:var(--l-accent)">chats.</span></div>`;
    await sleep(1300, skip);
  }

  document.removeEventListener("keydown", onKey);
  n.classList.add("out");
  setTimeout(() => { n.hidden = true; n.classList.remove("out"); n.innerHTML = ""; }, 700);
}
