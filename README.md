# chatwrap

Year-in-review for your WhatsApp chats, computed entirely in the browser.

- User picks (or drops) `~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared` from WhatsApp Desktop on macOS.
- `src/load.ts` grabs `ChatStorage.sqlite` (+ `-wal`), `ContactsV2.sqlite` (+ `-wal`) and `Media/Profile/*`.
- `src/wal.ts` merges the write-ahead log so data is current while WhatsApp runs.
- `src/analyze.ts` runs pure-logic stats over sql.js (WASM). No network, no LLM.
- `src/story.ts` renders each stat as a chat. `src/hide.ts` removes people the user hides.

No backend. Static deploy on Vercel.

```bash
npm i
npm run dev        # http://localhost:5173 ; dev-only test route: /?demo=/abs/path/to/folder-with-sqlite-copies
npm run build
```
