import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { applyWal } from "./wal";
import { analyze, type Stats } from "./analyze";
import { fromDrop, fromFileList, type Picked } from "./load";
import { mountStory, BRAND } from "./story";
import { hideNames } from "./hide";
import { playIntro, showOpening } from "./intro";
import "./landing.css";

const PATH = "~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared";
const landing = document.getElementById("landing")!;
const storyEl = document.getElementById("story")!;
const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);

landing.innerHTML = `
<main class="land">
  <section class="pitch">
    <p class="brand"><span class="logo" aria-hidden="true"></span>${BRAND}</p>
    <h1>Your year in <em>chats.</em></h1>
    <p class="lede">Your top 20 people, who answers fastest, who keeps you up at night, your most used words, your groups ranked. In about 10 seconds.</p>
    <ul class="promise">
      <li><b>Nothing is uploaded.</b> The whole analysis runs inside this browser tab. No server, no account.</li>
      <li><b>Close the tab and it's gone.</b> We store nothing, not even the results.</li>
    </ul>
    ${isMac ? "" : `<p class="warn">For now this works on a Mac with the WhatsApp Desktop app. Open this page on your Mac.</p>`}
  </section>
  <section class="steps" id="drop" aria-label="Connect your chats">
    <p class="pre"><span>You need <b>WhatsApp Desktop</b> on this Mac, linked to your phone. <a href="https://apps.apple.com/app/whatsapp-messenger/id310633997" rel="noopener">Get it free</a></span></p>
    <button type="button" class="connect" id="connect">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" fill="currentColor"/></svg>
      Connect WhatsApp
    </button>
    <p class="then">We copy the folder location for you. In the window that opens:</p>
    <ol class="keys" id="keys">
      <li><span class="n">1</span><span class="k"><kbd>⌘</kbd><kbd>⇧</kbd><kbd>G</kbd></span><span>Go to folder</span></li>
      <li><span class="n">2</span><span class="k"><kbd>⌘</kbd><kbd>V</kbd></span><span>Paste</span></li>
      <li><span class="n">3</span><span class="k"><kbd>↵</kbd></span><span>Enter</span></li>
      <li><span class="n">4</span><span class="k"><kbd>Upload</kbd></span><span>Then Allow if asked</span></li>
    </ol>
    <p class="fine">Your browser says "upload", but nothing leaves your Mac.</p>
    <p class="status" id="status" role="status" aria-live="polite"></p>
    <details id="manual">
      <summary>Didn't work? Do it by hand</summary>
      Open Finder, press <kbd>⌘</kbd><kbd>⇧</kbd><kbd>G</kbd> and go to:
      <span class="path"><code id="path">${PATH}</code><button type="button" id="copy">Copy</button></span>
      Then drag that folder anywhere on this card.
    </details>
    <input type="file" id="pick" webkitdirectory multiple hidden>
  </section>
</main>
<footer class="land-foot">Not affiliated with WhatsApp or Meta. Works best in Chrome or Safari on a laptop.</footer>`;

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
$("connect").addEventListener("click", () => {
  navigator.clipboard?.writeText(PATH).catch(() => ($("manual") as HTMLDetailsElement).open = true);
  animateKeys(true);
  ($("pick") as HTMLInputElement).click();
});
$("pick").addEventListener("cancel", () => { animateKeys(false); ($("manual") as HTMLDetailsElement).open = true; status("No folder picked. Try again, or use the manual way below."); });
$("pick").addEventListener("change", e => { animateKeys(false); const f = (e.target as HTMLInputElement).files; if (f?.length) run(() => fromFileList(f)); });
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(PATH); $("copy").textContent = "Copied"; setTimeout(() => ($("copy").textContent = "Copy"), 1500); }
  catch { getSelection()?.selectAllChildren($("path")); }
});
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
