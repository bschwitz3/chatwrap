# Chatwrap

**Your year in chats, Wrapped.** A free year-in-review for WhatsApp: your top 20 people, who replies fastest and slowest, your year month by month, your word of the year, and who runs your group chats — told as a chat-style story.

👉 **[chat-wrap.app](https://chat-wrap.app)**

## Your chats never leave your device

Chatwrap is a static website with no backend. When you connect your WhatsApp folder, your browser reads the files and computes every stat inside the open tab. Nothing is uploaded and nothing is stored. There are no cookies or trackers; the site only counts anonymous page visits with Vercel Web Analytics, which never sees your chats or stats.

Don't take our word for it:

- Open your browser's DevTools → **Network** tab while you run it: no request carries your data.
- Read the code in this repo — it is the code that runs on chat-wrap.app.

## How it works

1. On a Mac with **WhatsApp Desktop**, you pick the folder `~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared`.
2. [`src/load.ts`](src/load.ts) takes only what it needs: `ChatStorage.sqlite` (+ its `-wal` log), `ContactsV2.sqlite` and the profile thumbnails.
3. [`src/wal.ts`](src/wal.ts) merges the write-ahead log, so the data is current even while WhatsApp is running.
4. [`src/analyze.ts`](src/analyze.ts) runs the stats with [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly). Pure logic — no network, no AI.
5. [`src/story.ts`](src/story.ts) renders each stat as a chat. [`src/hide.ts`](src/hide.ts) removes anyone you choose to hide before you share a screenshot.

**Platform:** macOS with WhatsApp Desktop only, for now. WhatsApp encrypts its local data on Windows, and phones don't expose it to other apps.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Requires Node 20+. Stack: Vite, TypeScript, sql.js. No runtime dependencies beyond sql.js and two self-hosted fonts.

## Support

Chatwrap is free and made by one person. If you enjoyed it, you can [buy me a coffee ☕](https://buy.stripe.com/00w3cveB4afe297aDp0RG01).

## License

[AGPL-3.0](LICENSE). You can read, run, modify and share the code. If you run a modified version as a public service, you must publish your source code too.

---

Not affiliated with, endorsed by or connected to WhatsApp or Meta. WhatsApp is a trademark of Meta Platforms, Inc.
