// Merge a SQLite write-ahead log into the main database image, so we read what WhatsApp shows
// even while it is running. Only committed transactions whose salts match the WAL header apply.
export function applyWal(db: Uint8Array, wal: Uint8Array | null): Uint8Array {
  if (!wal || wal.length < 32) return asLegacy(db);
  const v = new DataView(wal.buffer, wal.byteOffset, wal.byteLength);
  const magic = v.getUint32(0);
  if (magic !== 0x377f0682 && magic !== 0x377f0683) return asLegacy(db);
  const pageSize = v.getUint32(8) || 65536;
  const salt1 = v.getUint32(16), salt2 = v.getUint32(20);
  const frameSize = 24 + pageSize;
  let out = db;
  let pending: Array<[number, number]> = []; // [pgno, offset of page data]
  for (let off = 32; off + frameSize <= wal.length; off += frameSize) {
    if (v.getUint32(off + 8) !== salt1 || v.getUint32(off + 12) !== salt2) break;
    pending.push([v.getUint32(off), off + 24]);
    const commitSize = v.getUint32(off + 4);
    if (commitSize > 0) {
      const need = commitSize * pageSize;
      if (out.length < need) { const grown = new Uint8Array(need); grown.set(out); out = grown; }
      else if (out.length > need) out = out.slice(0, need);
      for (const [pg, dataOff] of pending) {
        if (pg >= 1 && pg <= commitSize) out.set(wal.subarray(dataOff, dataOff + pageSize), (pg - 1) * pageSize);
      }
      pending = [];
    }
  }
  return asLegacy(out);
}

// Mark the image as rollback-journal mode; sql.js cannot open a WAL-mode file without its -shm.
function asLegacy(db: Uint8Array): Uint8Array {
  if (db.length > 19 && db[18] === 2) { db[18] = 1; db[19] = 1; }
  return db;
}
