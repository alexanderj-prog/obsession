const stores = new Map();
let counter = 0;

export function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  if (!stores.has(name)) stores.set(name, new Map());
  const map = stores.get(name);

  return {
    async get(key, o = {}) {
      const e = map.get(key);
      if (!e) return null;
      return o.type === "json" ? JSON.parse(e.value) : e.value;
    },
    async getWithMetadata(key, o = {}) {
      const e = map.get(key);
      if (!e) return null;
      return {
        data: o.type === "json" ? JSON.parse(e.value) : e.value,
        etag: e.etag,
        metadata: e.metadata || {},
      };
    },
    async set(key, value, o = {}) {
      const e = map.get(key);
      if (o.onlyIfNew && e) return { modified: false };
      if (o.onlyIfMatch && (!e || e.etag !== o.onlyIfMatch)) return { modified: false };
      const etag = `W/"${++counter}"`;
      map.set(key, { value: String(value), etag, metadata: o.metadata || {} });
      return { modified: true, etag };
    },
    async setJSON(key, value, o = {}) {
      const e = map.get(key);
      if (o.onlyIfNew && e) return { modified: false };
      if (o.onlyIfMatch && (!e || e.etag !== o.onlyIfMatch)) return { modified: false };
      const etag = `W/"${++counter}"`;
      map.set(key, { value: JSON.stringify(value), etag, metadata: o.metadata || {} });
      return { modified: true, etag };
    },
    async delete(key) {
      map.delete(key);
    },
    async list() {
      return { blobs: [...map.keys()].map((key) => ({ key, etag: map.get(key).etag })) };
    },
  };
}
