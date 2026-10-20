/**
 * Minimal reader for old Excel 97-2003 .xls files (BIFF8 inside an OLE2/CFB
 * container). exceljs only reads .xlsx, so the Import XLS button uses this
 * when the file starts with the OLE2 signature.
 *
 * Returns the FIRST worksheet as rows of plain values (string | number |
 * boolean | null), 0-indexed. Dates come back as Excel serial numbers, which
 * xlsImporter already understands.
 */

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export const isOleFile = (buf: ArrayBuffer): boolean => {
  const b = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
  return OLE_SIGNATURE.every((v, i) => b[i] === v);
};

// --- CFB (OLE2) container ---

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

function readCfbStream(buf: ArrayBuffer, names: string[]): Uint8Array | null {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const sectorSize = 1 << dv.getUint16(0x1e, true);
  const miniSectorSize = 1 << dv.getUint16(0x20, true);
  const firstDirSector = dv.getUint32(0x30, true);
  const miniCutoff = dv.getUint32(0x38, true);
  const firstMiniFat = dv.getUint32(0x3c, true);
  let difatSector = dv.getUint32(0x44, true);
  const numDifat = dv.getUint32(0x48, true);

  const sectorOffset = (n: number) => (n + 1) * sectorSize;

  // FAT sector list from header DIFAT (109 entries) plus DIFAT chain.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = dv.getUint32(0x4c + i * 4, true);
    if (s !== FREESECT && s !== ENDOFCHAIN) fatSectors.push(s);
  }
  const perSector = sectorSize / 4;
  for (let d = 0; d < numDifat && difatSector !== ENDOFCHAIN && difatSector !== FREESECT; d++) {
    const off = sectorOffset(difatSector);
    for (let i = 0; i < perSector - 1; i++) {
      const s = dv.getUint32(off + i * 4, true);
      if (s !== FREESECT && s !== ENDOFCHAIN) fatSectors.push(s);
    }
    difatSector = dv.getUint32(off + (perSector - 1) * 4, true);
  }
  const fat: number[] = [];
  for (const s of fatSectors) {
    const off = sectorOffset(s);
    for (let i = 0; i < perSector; i++) fat.push(dv.getUint32(off + i * 4, true));
  }

  const chain = (start: number, table: number[]): number[] => {
    const out: number[] = [];
    let s = start;
    while (s !== ENDOFCHAIN && s !== FREESECT && s < table.length && out.length <= table.length) {
      out.push(s);
      s = table[s];
    }
    return out;
  };
  const readChain = (start: number): Uint8Array => {
    const sectors = chain(start, fat);
    const out = new Uint8Array(sectors.length * sectorSize);
    sectors.forEach((s, i) => {
      const off = sectorOffset(s);
      out.set(bytes.subarray(off, Math.min(off + sectorSize, bytes.length)), i * sectorSize);
    });
    return out;
  };

  // Directory entries (128 bytes each).
  const dir = readChain(firstDirSector);
  const ddv = new DataView(dir.buffer);
  const entries: { name: string; type: number; start: number; size: number }[] = [];
  for (let off = 0; off + 128 <= dir.length; off += 128) {
    const nameLen = ddv.getUint16(off + 0x40, true);
    let name = '';
    for (let i = 0; i + 2 < nameLen; i += 2) name += String.fromCharCode(ddv.getUint16(off + i, true));
    entries.push({ name, type: dir[off + 0x42], start: ddv.getUint32(off + 0x74, true), size: ddv.getUint32(off + 0x78, true) });
  }
  const root = entries.find(e => e.type === 5);
  const entry = entries.find(e => e.type === 2 && names.includes(e.name));
  if (!entry || !root) return null;

  if (entry.size >= miniCutoff) return readChain(entry.start).subarray(0, entry.size);

  // Small stream: lives in the mini stream (root's chain), indexed by the mini FAT.
  const miniStream = readChain(root.start);
  const miniFatBytes = readChain(firstMiniFat);
  const mfdv = new DataView(miniFatBytes.buffer);
  const miniFat: number[] = [];
  for (let i = 0; i + 4 <= miniFatBytes.length; i += 4) miniFat.push(mfdv.getUint32(i, true));
  const sectors = chain(entry.start, miniFat);
  const out = new Uint8Array(sectors.length * miniSectorSize);
  sectors.forEach((s, i) => out.set(miniStream.subarray(s * miniSectorSize, (s + 1) * miniSectorSize), i * miniSectorSize));
  return out.subarray(0, entry.size);
}

// --- BIFF8 workbook stream ---

// Windows-1252 bytes 0x80-0x9F (compressed strings use the workbook code page).
const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};
const compressedChar = (b: number) => String.fromCharCode(CP1252[b] ?? b);

interface BiffRecord { type: number; data: Uint8Array; }

function readRecords(stream: Uint8Array, start = 0): BiffRecord[] {
  const out: BiffRecord[] = [];
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let pos = start;
  while (pos + 4 <= stream.length) {
    const type = dv.getUint16(pos, true);
    const len = dv.getUint16(pos + 2, true);
    out.push({ type, data: stream.subarray(pos + 4, pos + 4 + len) });
    pos += 4 + len;
  }
  return out;
}

/** Reads the shared string table, which may span CONTINUE records. */
function readSst(segments: Uint8Array[]): string[] {
  let seg = 0;
  let pos = 0;
  const ensure = () => {
    while (seg < segments.length && pos >= segments[seg].length) { seg++; pos = 0; }
  };
  const u8 = () => { ensure(); return segments[seg]?.[pos++] ?? 0; };
  const u16 = () => u8() | (u8() << 8);
  const u32 = () => (u16() | (u16() << 16)) >>> 0;
  const skip = (n: number) => { for (let i = 0; i < n; i++) u8(); };

  u32(); // total
  const unique = u32();
  const strings: string[] = [];
  for (let s = 0; s < unique; s++) {
    ensure();
    if (seg >= segments.length) break;
    const cch = u16();
    const flags = u8();
    let high = (flags & 0x01) !== 0;
    const runs = flags & 0x08 ? u16() : 0;
    const ext = flags & 0x04 ? u32() : 0;
    let str = '';
    for (let i = 0; i < cch; i++) {
      if (seg < segments.length && pos >= segments[seg].length) {
        // Character data continued in a CONTINUE record starts with a fresh flag byte.
        seg++; pos = 0;
        high = (u8() & 0x01) !== 0;
      }
      str += high ? String.fromCharCode(u16()) : compressedChar(u8());
    }
    skip(runs * 4 + ext);
    strings.push(str);
  }
  return strings;
}

function readUnicodeString(d: Uint8Array, off: number, lenBytes: 1 | 2): string {
  const cch = lenBytes === 2 ? d[off] | (d[off + 1] << 8) : d[off];
  const flags = d[off + lenBytes];
  let p = off + lenBytes + 1;
  if (flags & 0x08) p += 2;
  if (flags & 0x04) p += 4;
  let s = '';
  for (let i = 0; i < cch; i++) {
    if (flags & 0x01) { s += String.fromCharCode(d[p] | (d[p + 1] << 8)); p += 2; }
    else { s += compressedChar(d[p]); p += 1; }
  }
  return s;
}

function decodeRk(rk: number): number {
  let v: number;
  if (rk & 0x02) {
    v = rk >> 2;
  } else {
    const b = new DataView(new ArrayBuffer(8));
    b.setUint32(4, rk & 0xfffffffc, true);
    b.setUint32(0, 0, true);
    v = b.getFloat64(0, true);
  }
  return rk & 0x01 ? v / 100 : v;
}

export type CellRow = (string | number | boolean | null)[];

/** Parse the first worksheet of a BIFF8 .xls file into rows. */
export function readXlsFirstSheet(buf: ArrayBuffer): CellRow[] {
  const stream = readCfbStream(buf, ['Workbook', 'Book']);
  if (!stream) throw new Error('Not a valid .xls file (no Workbook stream).');

  const globals = readRecords(stream);
  let sst: string[] = [];
  let firstSheetPos = -1;
  for (let i = 0; i < globals.length; i++) {
    const r = globals[i];
    if (r.type === 0x00fc) {
      const segs = [r.data];
      for (let j = i + 1; j < globals.length && globals[j].type === 0x003c; j++) segs.push(globals[j].data);
      sst = readSst(segs);
    } else if (r.type === 0x0085 && firstSheetPos === -1) {
      const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      const kind = r.data[5]; // 0 = worksheet
      if (kind === 0) firstSheetPos = dv.getUint32(0, true);
    } else if (r.type === 0x000a) {
      break; // end of globals
    }
  }
  if (firstSheetPos < 0) return [];

  const rows: CellRow[] = [];
  const set = (row: number, col: number, v: string | number | boolean | null) => {
    while (rows.length <= row) rows.push([]);
    const r = rows[row];
    while (r.length < col) r.push(null);
    r[col] = v;
  };

  let pendingFormula: { row: number; col: number } | null = null;
  for (const r of readRecords(stream, firstSheetPos).slice(1)) {
    const d = r.data;
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (r.type === 0x000a) break; // EOF of this sheet
    if (r.type === 0x0809) break; // next substream started without EOF
    const row = d.length >= 4 ? dv.getUint16(0, true) : 0;
    const col = d.length >= 4 ? dv.getUint16(2, true) : 0;
    switch (r.type) {
      case 0x00fd: set(row, col, sst[dv.getUint32(6, true)] ?? ''); break; // LABELSST
      case 0x0203: set(row, col, dv.getFloat64(6, true)); break; // NUMBER
      case 0x027e: set(row, col, decodeRk(dv.getUint32(6, true))); break; // RK
      case 0x00bd: { // MULRK
        const last = dv.getUint16(d.length - 2, true);
        for (let c = col, p = 4; c <= last; c++, p += 6) set(row, c, decodeRk(dv.getUint32(p + 2, true)));
        break;
      }
      case 0x0204: set(row, col, readUnicodeString(d, 6, 2)); break; // LABEL
      case 0x0205: set(row, col, d[7] ? null : d[6] !== 0); break; // BOOLERR
      case 0x0006: { // FORMULA: cached result
        if (dv.getUint16(12, true) === 0xffff) {
          const kind = d[6];
          if (kind === 0) pendingFormula = { row, col };
          else if (kind === 1) set(row, col, d[8] !== 0);
          else set(row, col, null);
        } else {
          set(row, col, dv.getFloat64(6, true));
        }
        break;
      }
      case 0x0207: // STRING (result of the preceding string formula)
        if (pendingFormula) { set(pendingFormula.row, pendingFormula.col, readUnicodeString(d, 0, 2)); pendingFormula = null; }
        break;
    }
  }
  return rows;
}
