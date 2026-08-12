/**
 * Bağımlılıksız, minimal IndexedDB sarmalayıcı.
 * 10.000+ içerikli kütüphaneler localStorage kotasına (~5MB) sığmaz;
 * bu yüzden playlist ve içerik verisi IndexedDB'de tutulur.
 */

const DB_NAME = "stream-hub";
const DB_VERSION = 1;

export const STORES = {
  playlists: "playlists",
  items: "items",
  series: "series",
  tmdb: "tmdb-cache",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB bu ortamda kullanılamıyor"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          if (name === STORES.items || name === STORES.series) {
            store.createIndex("playlistId", "playlistId", { unique: false });
          }
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB açılamadı"));
  });

  return dbPromise;
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Büyük dizileri tek transaction'da yazar (10k kayıt ~200ms). */
export async function idbBulkPut<T>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    for (const value of values) objectStore.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDeleteByIndex(store: StoreName, index: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    if (!objectStore.indexNames.contains(index)) {
      tx.abort();
      reject(new Error(`Index bulunamadı: ${index}`));
      return;
    }
    // Cursor ile tek tek gezmek yerine anahtarları tek seferde al: 35.000 kayıtlık
    // bir playlist'te aradaki fark saniyelerle ölçülüyor.
    const keysRequest = objectStore.index(index).getAllKeys(IDBKeyRange.only(value));
    keysRequest.onsuccess = () => {
      for (const key of keysRequest.result) objectStore.delete(key);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Bir playlist'in tüm kayıtlarını tek transaction'da değiştirir.
 * Silme + yazmayı ayrı transaction'lara bölmek 35.000 kayıtta belirgin yavaşlık yaratıyordu.
 */
export async function idbReplaceByIndex<T>(
  store: StoreName,
  index: string,
  value: string,
  records: T[],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);

    const keysRequest = objectStore.index(index).getAllKeys(IDBKeyRange.only(value));
    keysRequest.onsuccess = () => {
      for (const key of keysRequest.result) objectStore.delete(key);
      for (const record of records) objectStore.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
