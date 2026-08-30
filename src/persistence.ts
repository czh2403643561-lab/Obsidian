import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";

const DATABASE_NAME = "obsidian-workbench";
const STORE_NAME = "workspace-snapshots";
const PRODUCT_IMAGE_STORE = "product-images";
const DATABASE_SCHEMA_VERSION = 2;
const SNAPSHOT_SCHEMA_VERSION = 1;
const RESET_EVENT = "obsidian:clear-local-data";
const PRODUCT_IMAGES_UPDATED_EVENT = "obsidian:product-images-updated";

interface Snapshot<T> {
  key: string;
  schemaVersion: number;
  savedAt: string;
  data: T;
}

export interface ProductImageCacheEntry {
  productId: string;
  imageBlob: Blob;
  sourceUrl?: string;
  fetchedAt: string;
}

const isAvailable = (): boolean => typeof window !== "undefined" && "indexedDB" in window;

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!isAvailable()) { reject(new Error("IndexedDB unavailable")); return; }
  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_SCHEMA_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    if (!request.result.objectStoreNames.contains(PRODUCT_IMAGE_STORE)) request.result.createObjectStore(PRODUCT_IMAGE_STORE, { keyPath: "productId" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    return await new Promise<T>((resolve, reject) => {
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
};

const withProductImageStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PRODUCT_IMAGE_STORE, mode);
    const request = run(transaction.objectStore(PRODUCT_IMAGE_STORE));
    return await new Promise<T>((resolve, reject) => {
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
};

export const loadSnapshot = async <T>(key: string): Promise<T | null> => {
  try {
    const snapshot = await withStore<Snapshot<T> | undefined>("readonly", (store) => store.get(key));
    return snapshot?.schemaVersion === SNAPSHOT_SCHEMA_VERSION && snapshot.data ? snapshot.data : null;
  } catch { return null; }
};

export const saveSnapshot = async <T>(key: string, data: T): Promise<void> => {
  try {
    await withStore<IDBValidKey>("readwrite", (store) => store.put({ key, schemaVersion: SNAPSHOT_SCHEMA_VERSION, savedAt: new Date().toISOString(), data } satisfies Snapshot<T>));
  } catch { /* 本地存储不可用时仍保持页面可用 */ }
};

export const getProductImage = async (productId: string): Promise<ProductImageCacheEntry | null> => {
  try {
    return await withProductImageStore<ProductImageCacheEntry | undefined>("readonly", (store) => store.get(productId)) ?? null;
  } catch { return null; }
};

export const saveProductImage = async (entry: ProductImageCacheEntry): Promise<void> => {
  try {
    await withProductImageStore<IDBValidKey>("readwrite", (store) => store.put(entry));
    window.dispatchEvent(new Event(PRODUCT_IMAGES_UPDATED_EVENT));
  } catch { /* 图片缓存不可用时仍保持页面可用 */ }
};

export const subscribeToProductImageUpdates = (listener: () => void): (() => void) => {
  window.addEventListener(PRODUCT_IMAGES_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PRODUCT_IMAGES_UPDATED_EVENT, listener);
};

export const getProductImageCacheSummary = async (productIds: string[]): Promise<{ cached: number; latestFetchedAt: string | null }> => {
  try {
    const entries = await withProductImageStore<ProductImageCacheEntry[]>("readonly", (store) => store.getAll());
    const currentIds = new Set(productIds);
    const matched = entries.filter((entry) => currentIds.has(entry.productId));
    const latestFetchedAt = entries.reduce<string | null>((latest, entry) => !latest || entry.fetchedAt > latest ? entry.fetchedAt : latest, null);
    return { cached: matched.length, latestFetchedAt };
  } catch { return { cached: 0, latestFetchedAt: null }; }
};

export const clearWorkspaceData = async (): Promise<void> => {
  if (!isAvailable()) return;
  await new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(DATABASE_NAME);
    const finish = () => { resolve(); };
    request.onsuccess = finish;
    request.onerror = finish;
    request.onblocked = finish;
  });
};

export const resetPersistedState = (): void => { window.dispatchEvent(new Event(RESET_EVENT)); };

export function usePersistedState<T>(key: string, createInitial: () => T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const initialRef = useRef(createInitial);
  const [state, setState] = useState<T>(() => initialRef.current());
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSnapshot<T>(key).then((saved) => {
      if (active && saved) setState(saved);
    }).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => { void saveSnapshot(key, state); }, 350);
    return () => window.clearTimeout(timer);
  }, [key, restored, state]);

  useEffect(() => {
    const reset = () => setState(initialRef.current());
    window.addEventListener(RESET_EVENT, reset);
    return () => window.removeEventListener(RESET_EVENT, reset);
  }, []);

  return [state, setState, restored];
}
