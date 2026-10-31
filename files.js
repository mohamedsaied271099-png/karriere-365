// تخزين ملفات الشهادات والصورة على الجهاز (IndexedDB) — مش بتترفع على أي سيرفر
const DB = "karriere365-files", STORE = "files";

function db() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => fail(t.error);
  });
}

export const putFile = (id, file) => tx("readwrite", (s) => s.put({ blob: file, name: file.name, type: file.type }, id));
export const getFile = (id) => tx("readonly", (s) => s.get(id));
export const delFile = (id) => tx("readwrite", (s) => s.delete(id));
export const allFiles = async () => {
  const keys = await tx("readonly", (s) => s.getAllKeys());
  return Promise.all(keys.map(async (k) => [k, await getFile(k)]));
};

// للنسخة الاحتياطية: الملفات بتتحول لنص وترجع تاني
const toDataURL = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
export async function exportFiles() {
  const out = {};
  for (const [k, f] of await allFiles()) if (f) out[k] = { name: f.name, type: f.type, data: await toDataURL(f.blob) };
  return out;
}
export async function importFiles(obj) {
  for (const [k, f] of Object.entries(obj || {})) {
    const blob = await (await fetch(f.data)).blob();
    await tx("readwrite", (s) => s.put({ blob, name: f.name, type: f.type }, k));
  }
}
