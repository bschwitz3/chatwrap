import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { applyWal } from "./wal";
import { analyze, type Stats } from "./analyze";
import { fromDrop, fromFileList, type Picked } from "./load";
import { mountStory, BRAND } from "./story";
import { hideNames } from "./hide";
import "./landing.css";

const PATH = "~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared";
const landing = document.getElementById("landing")!;
const storyEl = document.getElementById("story")!;
const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);

landing.innerHTML = `
<main class="land">
  <section class="pitch">
    <p class="brand"><span class="logo" aria-hidden="true"></span>${BRAND}</p>
    <h1>Your year in chats.</h1>
    <p class="lede">Your top 20 people, who answers fastest, who keeps you up at night, your most used words, your groups ranked. Built from your WhatsApp, in about 10 seconds.</p>
    <ul class="promise">
      <li><b>Nothing is uploaded.</b> The whole analysis runs inside this browser tab. There is no server and no account.</li>
      <li><b>Close the tab and it's gone.</b> We store nothing, not even the results.</li>
    </ul>
    ${isMac ? "" : `<p class="warn">For now this works on a Mac with the WhatsApp Desktop app. Open this page on your Mac.</p>`}
  </section>
  <section class="steps" aria-labelledby="how">
    <h2 id="how">3 steps</h2>
    <ol>
      <li><b>Install WhatsApp Desktop</b> on your Mac (Mac App Store), link your phone, and wait until your chats appear. It syncs about one year of history.</li>
      <li><b>Click the button below.</b> In the window, press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd>, paste this path and press <kbd>Enter</kbd>:
        <span class="path"><code id="path">${PATH}</code><button type="button" id="copy">Copy</button></span>
        Then click <b>Upload</b> or <b>Select</b>.</li>
      <li><b>Click Allow</b> if your Mac or browser asks. Your browser says "upload", but the files never leave your computer.</li>
    </ol>
    <label class="drop" id="drop" for="pick">
      <input type="file" id="pick" webkitdirectory multiple hidden>
      <span class="drop-cta">Choose the WhatsApp folder</span>
      <span class="drop-sub">or drag the <code>group.net.whatsapp.WhatsApp.shared</code> folder here</span>
    </label>
    <p class="status" id="status" role="status" aria-live="polite"></p>
  </section>
</main>
<footer class="land-foot">Not affiliated with WhatsApp or Meta. Open source soon. Works best in Chrome or Safari on a laptop.</footer>`;

const $ = (id: string) => document.getElementById(id)!;
const status = (msg: string, err = false) => { $("status").textContent = msg; $("status").classList.toggle("err", err); };

$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(PATH); $("copy").textContent = "Copied"; setTimeout(() => ($("copy").textContent = "Copy"), 1500); }
  catch { getSelection()?.selectAllChildren($("path")); }
});
$("pick").addEventListener("change", e => { const f = (e.target as HTMLInputElement).files; if (f?.length) run(() => fromFileList(f)); });
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
  try {
    status("Reading your chats…");
    const p = await get();
    status(`Found your chats (${(p.chat.size / 1e6).toFixed(0)} MB). Counting…`);
    await new Promise(r => setTimeout(r, 30));
    const chat = await open(p.chat, p.chatWal);
    let contacts: Database | null = null;
    try { contacts = await open(p.contacts, p.contactsWal); } catch { contacts = null; }
    base = analyze({ chat: chat!, contacts, pics: p.pics });
    chat!.close(); contacts?.close();
    show();
  } catch (e) {
    console.error(e);
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

// Dev only: ?demo loads a local copy of the database through Vite's /@fs route.
if (import.meta.env.DEV && location.search.includes("demo=")) {
  const dir = new URLSearchParams(location.search).get("demo")!;
  const f = async (n: string) => { const r = await fetch(`/@fs${dir}/${n}`); return r.ok ? new File([await r.blob()], n) : null; };
  run(async () => ({ chat: (await f("ChatStorage.sqlite"))!, chatWal: await f("ChatStorage.sqlite-wal"), contacts: await f("ContactsV2.sqlite"), contactsWal: await f("ContactsV2.sqlite-wal"), pics: new Map() }));
}
