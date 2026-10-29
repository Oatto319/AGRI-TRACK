/* eslint-disable @typescript-eslint/no-explicit-any */
// MongoDB จำลองในหน่วยความจำ เฉพาะความสามารถที่แอปใช้ (เทสต์รันได้โดยไม่ต้องมีฐานข้อมูลจริง)
type Doc = Record<string, any>;
const clone = <T,>(x: T): T => structuredClone(x);

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === "$or") return (cond as Doc[]).some(f => matches(doc, f));
    const v = doc[k];
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]: [string, any]) => {
        switch (op) {
          case "$exists": return (v !== undefined) === arg;
          case "$ne": return v !== arg;
          case "$in": return (arg as any[]).includes(v);
          case "$gt": return v > arg;
          case "$lt": return v < arg;
          default: throw new Error(`fakeMongo: ไม่รองรับ ${op}`);
        }
      });
    }
    return v === cond;
  });
}
function project(doc: Doc, opts?: { projection?: Doc }) {
  const p = opts?.projection; if (!p) return doc;
  const inc = Object.entries(p).filter(([k, v]) => k !== "_id" && v).map(([k]) => k);
  const out: Doc = inc.length ? Object.fromEntries(inc.filter(k => k in doc).map(k => [k, doc[k]])) : { ...doc };
  if (p._id !== 0 && "_id" in doc) out._id = doc._id;
  if (p._id === 0) delete out._id;
  return out;
}
let seq = 0;

class Collection {
  docs: Doc[] = [];
  private uniques: string[][] = [];
  async createIndex(spec: Doc, opts?: { unique?: boolean }) { if (opts?.unique) this.uniques.push(Object.keys(spec)); return "ok"; }
  private dup(doc: Doc, ignore?: Doc) { return this.uniques.some(keys => this.docs.some(d => d !== ignore && keys.every(k => d[k] === doc[k]))); }
  async findOne(filter: Doc = {}, opts?: { projection?: Doc }) { const d = this.docs.find(x => matches(x, filter)); return d ? project(clone(d), opts) : null; }
  find(filter: Doc = {}, opts?: { projection?: Doc }) {
    let rows = this.docs.filter(x => matches(x, filter)).map(x => project(clone(x), opts));
    const cur = {
      sort(spec: Doc) { rows = [...rows].sort((a, b) => { for (const [k, dir] of Object.entries(spec)) { if (a[k] < b[k]) return -1 * (dir as number); if (a[k] > b[k]) return 1 * (dir as number); } return 0; }); return cur; },
      async toArray() { return rows; },
    };
    return cur;
  }
  async insertOne(doc: Doc) {
    if (this.dup(doc)) throw Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
    const d = clone(doc); if (d._id === undefined) d._id = `oid${++seq}`;
    this.docs.push(d); return { insertedId: d._id };
  }
  async replaceOne(filter: Doc, doc: Doc, opts?: { upsert?: boolean }) {
    const i = this.docs.findIndex(x => matches(x, filter));
    if (i < 0) {
      if (opts?.upsert) { await this.insertOne({ ...Object.fromEntries(Object.entries(filter).filter(([k, v]) => k === "_id" && typeof v !== "object")), ...doc }); return { matchedCount: 0, upsertedCount: 1 }; }
      return { matchedCount: 0, upsertedCount: 0 };
    }
    this.docs[i] = { _id: this.docs[i]._id, ...clone(doc) }; return { matchedCount: 1, upsertedCount: 0 };
  }
  async updateOne(filter: Doc, update: Doc, opts?: { upsert?: boolean }) {
    let d = this.docs.find(x => matches(x, filter)); let inserted = false;
    if (!d) {
      if (!opts?.upsert) return { matchedCount: 0 };
      d = Object.fromEntries(Object.entries(filter).filter(([k, v]) => !k.startsWith("$") && (typeof v !== "object" || v instanceof Date)));
      Object.assign(d, clone(update.$setOnInsert ?? {})); this.docs.push(d); inserted = true; if (d._id === undefined) d._id = `oid${++seq}`;
    }
    Object.assign(d, clone(update.$set ?? {}));
    for (const [k, n] of Object.entries(update.$inc ?? {})) d[k] = (d[k] ?? 0) + (n as number);
    for (const k of Object.keys(update.$unset ?? {})) delete d[k];
    return { matchedCount: inserted ? 0 : 1 };
  }
  async deleteOne(filter: Doc) { const i = this.docs.findIndex(x => matches(x, filter)); if (i >= 0) this.docs.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; }
  async deleteMany(filter: Doc = {}) { const before = this.docs.length; this.docs = this.docs.filter(x => !matches(x, filter)); return { deletedCount: before - this.docs.length }; }
  async countDocuments(filter: Doc = {}) { return this.docs.filter(x => matches(x, filter)).length; }
}

export function createFakeDb() {
  const cols = new Map<string, Collection>();
  const state = { failPing: false };
  return {
    state,
    collection: (name: string) => { if (!cols.has(name)) cols.set(name, new Collection()); return cols.get(name)!; },
    command: async () => { if (state.failPing) throw new Error("db down"); return { ok: 1 }; },
    reset() { cols.clear(); state.failPing = false; },
  };
}
export type FakeDb = ReturnType<typeof createFakeDb>;
