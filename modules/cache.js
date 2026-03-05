// GitInsight – IndexedDB Caching Layer
// Caches processed commit data to avoid re-fetching

const Cache = {
    DB_NAME: 'GitInsightCache',
    DB_VERSION: 1,
    STORE_NAME: 'repos',
    TTL: 60 * 60 * 1000, // 1 hour

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async get(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                if (result && (Date.now() - result.timestamp < this.TTL)) {
                    resolve(result.data);
                } else {
                    resolve(null); // Expired or not found
                }
            };
            request.onerror = () => resolve(null);
        });
    },

    async set(key, data) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.put({ key, data, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async clear(key) {
        const db = await this.openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            if (key) {
                store.delete(key);
            } else {
                store.clear();
            }
            tx.oncomplete = () => resolve();
        });
    }
};

if (typeof window !== 'undefined') window.Cache = Cache;
