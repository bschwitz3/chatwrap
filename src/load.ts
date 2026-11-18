// Collect the few files we need from the WhatsApp shared folder, whether picked or dropped.
export type Picked = { chat: File; chatWal: File | null; contacts: File | null; contactsWal: File | null; pics: Map<string, File> };

const PROFILE = "Media/Profile/";

export function fromFileList(list: FileList | File[]): Picked {
  const files = [...list];
  const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
  const pick = (name: string) => files.filter(f => f.name === name).sort((a, b) => rel(a).length - rel(b).length)[0] ?? null;
  const chat = pick("ChatStorage.sqlite");
  if (!chat) throw new NotWhatsApp();
  const pics = new Map<string, File>();
  for (const f of files) {
    const p = rel(f), i = p.indexOf(PROFILE);
    if (i >= 0) pics.set(p.slice(i), f);
    else if (/\/Profile\/[^/]+$/.test(p)) pics.set(PROFILE + f.name, f);
  }
  return { chat, chatWal: pick("ChatStorage.sqlite-wal"), contacts: pick("ContactsV2.sqlite"), contactsWal: pick("ContactsV2.sqlite-wal"), pics };
}

export class NotWhatsApp extends Error {
  constructor() { super("We couldn't find ChatStorage.sqlite. Pick the folder named group.net.whatsapp.WhatsApp.shared."); }
}

// Drag and drop: walk only the paths we need instead of the whole (large) folder.
type Entry = FileSystemEntry;
const asFile = (e: FileSystemFileEntry) => new Promise<File>((res, rej) => e.file(res, rej));
const child = (dir: FileSystemDirectoryEntry, path: string, dirWanted: boolean) =>
  new Promise<Entry | null>(res => (dirWanted ? dir.getDirectory : dir.getFile).call(dir, path, {}, e => res(e), () => res(null)));
const readAll = (dir: FileSystemDirectoryEntry) => new Promise<Entry[]>(res => {
  const r = dir.createReader(), all: Entry[] = [];
  const next = () => r.readEntries(b => { if (!b.length) res(all); else { all.push(...b); next(); } }, () => res(all));
  next();
});

export async function fromDrop(items: DataTransferItemList): Promise<Picked> {
  const entries = [...items].map(i => i.webkitGetAsEntry()).filter(Boolean) as Entry[];
  const loose: File[] = [];
  for (const e of entries) {
    if (e.isFile) { loose.push(await asFile(e as FileSystemFileEntry)); continue; }
    let root = e as FileSystemDirectoryEntry;
    // accept the parent "Group Containers" folder too
    const inner = await child(root, "group.net.whatsapp.WhatsApp.shared", true);
    if (inner) root = inner as FileSystemDirectoryEntry;
    const get = async (name: string) => { const f = await child(root, name, false); return f ? asFile(f as FileSystemFileEntry) : null; };
    const chat = await get("ChatStorage.sqlite");
    if (!chat) continue;
    const pics = new Map<string, File>();
    const prof = await child(root, "Media/Profile", true);
    if (prof) for (const p of await readAll(prof as FileSystemDirectoryEntry)) if (p.isFile) pics.set(PROFILE + p.name, await asFile(p as FileSystemFileEntry));
    return { chat, chatWal: await get("ChatStorage.sqlite-wal"), contacts: await get("ContactsV2.sqlite"), contactsWal: await get("ContactsV2.sqlite-wal"), pics };
  }
  return fromFileList(loose);
}
