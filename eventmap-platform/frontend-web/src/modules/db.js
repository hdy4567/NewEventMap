/**
 * 🚀 SMART FACTORY DB (v1.0)
 * Persistent storage using IndexedDB for high-volume marker data.
 */

const DB_NAME = 'EventMapDB';
const STORE_NAME = 'events';
const DB_VERSION = 1;

export class EventDB {
  static async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('region', 'region', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getAll() {
    const db = await this.open();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }

  static async saveAll(events) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      events.forEach(event => {
        if (!event.id) event.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        store.put(event);
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async putMany(events) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      events.forEach(event => {
        if (!event.id) event.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        store.put(event);
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async put(event) {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (!event.id) event.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    store.put(event);
  }

  static async delete(id) {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
  }
}
