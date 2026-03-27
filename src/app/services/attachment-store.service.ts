import { Injectable } from '@angular/core';

/**
 * AttachmentStoreService wraps IndexedDB to store binary blobs for media notes.
 *
 * Why IndexedDB and not localStorage?
 *  - localStorage is limited to ~5 MB per origin and only handles strings.
 *    A single audio or video file can easily exceed that.
 *  - IndexedDB stores Blobs natively, without base-64 overhead.
 *
 * The service is lazy: the DB connection is opened on first use and then
 * cached. All public methods return Promises so callers can await them safely.
 *
 * SSR guard: the constructor detects whether `indexedDB` is available and
 * degrades silently (all operations become no-ops) during the server pre-pass.
 */
@Injectable({ providedIn: 'root' })
export class AttachmentStoreService {
  private readonly DB_NAME = 'noted_attachments';
  private readonly STORE  = 'blobs';
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof indexedDB !== 'undefined') {
      this.dbPromise = this.openDb();
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE);
        }
      };
      req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror   = () => reject(req.error);
    });
  }

  private async db(): Promise<IDBDatabase | null> {
    return this.dbPromise ? this.dbPromise : null;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async save(id: string, blob: Blob): Promise<void> {
    const db = await this.db();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async get(id: string): Promise<Blob | null> {
    const db = await this.db();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.db();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await Promise.all(ids.map(id => this.delete(id)));
  }

  /**
   * Creates a temporary object URL for playback / display.
   * The caller is responsible for calling URL.revokeObjectURL() when done,
   * or the browser will revoke it automatically on page unload.
   */
  async createObjectUrl(id: string): Promise<string | null> {
    const blob = await this.get(id);
    return blob ? URL.createObjectURL(blob) : null;
  }

  /**
   * Triggers a native browser download for the attachment.
   */
  async download(id: string, filename: string): Promise<void> {
    const blob = await this.get(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
