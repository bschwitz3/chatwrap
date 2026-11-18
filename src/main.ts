import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { applyWal } from "./wal";
import { analyze, type Stats } from "./analyze";
import { fromDrop, fromFileList, type Picked } from "./load";
import { mountStory, BRAND } from "./story";
import { hideNames } from "./hide";
import { playIntro, showOpening } from "./intro";
import { mountShowcase } from "./showcase";
import { themeButton, bindTheme } from "./theme";
import "./landing.css";

// Set COFFEE_URL to a Stripe Payment Link / Buy Me a Coffee page; the button stays hidden while empty.
const COFFEE_URL = "";
const coffee = (cls = "coffee") => COFFEE_URL ? `<a class="${cls}" href="${COFFEE_URL}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13v5a6 6 0 01-6 6H10a6 6 0 01-6-6zM17 10h1.5a2.5 2.5 0 010 5H17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 2.5c0 1.5 1.5 1.5 1.5 3M12 2.5c0 1.5 1.5 1.5 1.5 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Buy me a coffee</a>` : "";
const PATH = "~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared";
const landing = document.getElementById("landing")!;
const storyEl = document.getElementById("story")!;
const ua = navigator.userAgent;
const isTouchMac = /Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1; // iPadOS reports "MacIntel"
const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || isTouchMac;
const isMac = /Mac/i.test(navigator.platform || ua) && !isMobile;

landing.innerHTML = `
<main class="land">
  <section class="pitch">
    <div class="brand-row"><p class="brand"><span class="logo" aria-hidden="true"></span>${BRAND}</p>${themeButton("theme-land")}</div>
    <h1 class="h-xs">Your year in <em>chats.</em></h1>
    <p class="sub">19 little stories about you and your people, built from your WhatsApp in 10 seconds.</p>
    <div class="stage" id="stage" aria-hidden="true"></div>
    <div class="dots" id="dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="chips-row"><span class="pill">Nothing uploaded</span><span class="pill">No account</span><span class="pill">Free</span></div>
  </section>
  <section class="steps" id="drop" aria-label="How to connect">
    <ol class="stepper">
      <li class="st ${isMac ? "done" : "blocked"}" id="st1">
        <span class="dot" aria-hidden="true">1</span>
        <div class="body">
          <h3>Use a Mac with WhatsApp Desktop</h3>
          ${isMobile
            ? `<p><b>You're on a phone.</b> Chatwrap reads your chats from the WhatsApp Desktop app, so it needs a Mac. Send this link to yourself and open it there.</p><button type="button" class="share" id="share">Send this link to my Mac</button>`
            : isMac
            ? `<p>You're on a Mac. Make sure the <b>WhatsApp Desktop</b> app is installed, linked to your phone, and your chats are visible. <a href="https://apps.apple.com/app/whatsapp-messenger/id310633997" rel="noopener">Get it free</a></p>`
            : `<p><b>This only works on a Mac for now.</b> On Windows, WhatsApp encrypts its chat data, so a website can't read it. Open this page on a Mac with WhatsApp Desktop installed.</p>`}
        </div>
      </li>
      <li class="st ${isMac ? "active" : ""}" id="st2">
        <span class="dot" aria-hidden="true">2</span>
        <div class="body">
          <h3>Copy the folder location</h3>
          <span class="path"><code id="path">${PATH}</code><button type="button" id="copy">Copy</button></span>
        </div>
      </li>
      <li class="st" id="st3">
        <span class="dot" aria-hidden="true">3</span>
        <div class="body">
          <h3>Click Connect WhatsApp</h3>
          <p>In the window that opens, you'll do this:</p>
          <ol class="keys" id="keys">
            <li><span class="k"><kbd>⌘</kbd><kbd>⇧</kbd><kbd>G</kbd></span><span>Go to folder</span></li>
            <li><span class="k"><kbd>⌘</kbd><kbd>V</kbd></span><span>Paste</span></li>
            <li><span class="k"><kbd>↵</kbd></span><span>Enter</span></li>
            <li><span class="k"><kbd>Upload</kbd></span><span>Click it</span></li>
          </ol>
          <button type="button" class="connect" id="connect">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" fill="currentColor"/></svg>
            Connect WhatsApp
          </button>
        </div>
      </li>
      <li class="st" id="st4">
        <span class="dot" aria-hidden="true">4</span>
        <div class="body">
          <h3>Click Allow if asked</h3>
          <p>Your browser or Mac may ask for permission. The browser says "upload", but nothing leaves your Mac.</p>
        </div>
      </li>
    </ol>
    <p class="status" id="status" role="status" aria-live="polite"></p>
    <p class="fine drag">Or drag the <code>group.net.whatsapp.WhatsApp.shared</code> folder from Finder onto this card.</p>
    <input type="file" id="pick" webkitdirectory multiple hidden>
  </section>
</main>
<footer class="land-foot"><span>Not affiliated with WhatsApp or Meta. Works best in Chrome or Safari on a laptop.</span>${coffee()}</footer>`;

const $ = (id: string) => document.getElementById(id)!;
const status = (msg: string, err = false) => { $("status").textContent = msg; $("status").classList.toggle("err", err); };

// One click: copy the path, open the picker, light up the keys one by one.
let keyTimer = 0;
function animateKeys(on: boolean) {
  const keys = $("keys"), items = [...keys.querySelectorAll("li")];
  clearInterval(keyTimer); keys.classList.toggle("live", on); items.forEach(li => li.classList.remove("on"));
  if (!on || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let i = 0; items[0].classList.add("on");
  keyTimer = window.setInterval(() => { items.forEach(li => li.classList.remove("on")); i = (i + 1) % items.length; items[i].classList.add("on"); }, 1100);
}
mountShowcase($("stage"), $("dots"));
bindTheme("theme-land");
document.getElementById("share")?.addEventListener("click", async () => {
  const url = location.origin, b = $("share");
  try {
    if (navigator.share) await navigator.share({ title: BRAND, text: "Open this on my Mac", url });
    else { await navigator.clipboard.writeText(url); b.textContent = "Link copied ✓"; }
  } catch { /* user closed the share sheet */ }
});
const stepTo = (n: number) => {
  for (let i = 2; i <= 4; i++) { const li = $("st" + i); li.classList.toggle("done", i < n); li.classList.toggle("active", i === n || (n === 4 && i === 3)); }
};
let copied = false;
async function copyPath() {
  try { await navigator.clipboard.writeText(PATH); copied = true; $("copy").textContent = "Copied ✓"; }
  catch { getSelection()?.selectAllChildren($("path")); $("copy").textContent = "Press ⌘C"; }
}
$("copy").addEventListener("click", async () => { await copyPath(); stepTo(3); });
$("connect").addEventListener("click", () => {
  if (!copied) navigator.clipboard?.writeText(PATH).then(() => { copied = true; $("copy").textContent = "Copied ✓"; }).catch(() => {});
  stepTo(4); animateKeys(true);
  ($("pick") as HTMLInputElement).click();
});
$("pick").addEventListener("cancel", () => { animateKeys(false); stepTo(3); status("No folder picked. Click Connect WhatsApp again."); });
$("pick").addEventListener("change", e => { animateKeys(false); const f = (e.target as HTMLInputElement).files; if (f?.length) run(() => fromFileList(f)); });
const drop = $("drop");
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer) run(() => fromDrop(e.dataTransfer!.items)); });

let SQL: Promise<SqlJsStatic> | null = null;
const sql = () => (SQL ??= initSqlJs({ locateFile: () => wasmUrl }));
const bytes = async (f: File | null) => (f ? new Uint8Array(await f.arrayBuffer()) : null);
async function open(main: File | null, wal: File | null): Promise<Database | null> {
  const m = await bytes(main);
  if (!m) return null;
  return new (await sql()).Database(applyWal(m, await bytes(wal)));
}

let base: Stats | null = null;
let hidden = new Set<string>();

async function run(get: () => Picked | Promise<Picked>) {
  let closeOpening: (() => void) | null = null;
  try {
    const p = await get();
    closeOpening = showOpening(`${(p.chat.size / 1e6).toFixed(0)} MB of chats`);
    await new Promise(r => setTimeout(r, 60));
    const chat = await open(p.chat, p.chatWal);
    let contacts: Database | null = null;
    try { contacts = await open(p.contacts, p.contactsWal); } catch { contacts = null; }
    base = analyze({ chat: chat!, contacts, pics: p.pics });
    chat!.close(); contacts?.close();
    await playIntro(base);
    show();
  } catch (e) {
    console.error(e);
    closeOpening?.();
    status(e instanceof Error ? e.message : "Something went wrong reading that folder.", true);
  }
}

function show() {
  if (!base) return;
  landing.hidden = true; storyEl.hidden = false;
  document.body.classList.add("in-story");
  mountStory(storyEl, hideNames(base, hidden), {
    hidden,
    onHide: (h: Set<string>) => { hidden = h; show(); },
    onRestart: () => { location.hash = ""; location.reload(); },
  });
}

// Dev only: ?demo=/abs/dir loads a local copy of the database through Vite's /@fs route.
if (import.meta.env.DEV && location.search.includes("demo=")) {
  const dir = new URLSearchParams(location.search).get("demo")!;
  const f = async (n: string) => { const r = await fetch(`/@fs${dir}/${n}`); return r.ok ? new File([await r.blob()], n) : null; };
  run(async () => ({ chat: (await f("ChatStorage.sqlite"))!, chatWal: await f("ChatStorage.sqlite-wal"), contacts: await f("ContactsV2.sqlite"), contactsWal: await f("ContactsV2.sqlite-wal"), pics: new Map() }));
}
