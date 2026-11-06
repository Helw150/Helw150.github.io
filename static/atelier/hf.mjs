// Hugging Face transport. Fixed origin; credentials are never put in URLs or storage.
import { checkedPath } from './format.mjs';
const HUB = 'https://huggingface.co';
const segment = (value) => encodeURIComponent(value);
export function repoAddress(input, type = 'dataset', revision = 'main') {
  let id = input.trim();
  if (id.startsWith('https://')) {
    const url = new URL(id);
    if (url.origin !== HUB || url.username || url.password)
      throw Error('Use a huggingface.co repository URL');
    const parts = url.pathname.split('/').filter(Boolean);
    type = parts[0] === 'datasets' ? 'dataset' : parts[0] === 'spaces' ? 'space' : 'model';
    if (type !== 'model') parts.shift();
    if (parts.length !== 2) throw Error('Use the repository URL; enter its revision separately');
    id = parts.join('/');
  }
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(id) ||
    id.split('/').some((p) => p === '.' || p === '..') ||
    !['dataset', 'model', 'space'].includes(type)
  )
    throw Error('Expected owner/repository');
  if (!revision.trim() || /[\x00-\x1f]/.test(revision)) throw Error('Invalid revision');
  return { id, type, revision: revision.trim() };
}
export class HFSource {
  constructor(address, token = '', fetcher = (...args) => globalThis.fetch(...args)) {
    this.address = address;
    this.token = token.trim();
    this.fetcher = fetcher;
    this.cache = new Map();
    this.cachedBytes = 0;
  }
  async request(url) {
    if (new URL(url).origin !== HUB) throw Error('Unexpected repository API origin');
    const response = await this.fetcher(url, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      throw Error(
        [401, 403, 404].includes(response.status)
          ? 'Repository or file unavailable. Check its name and provide a read token for private repositories.'
          : `Hugging Face returned HTTP ${response.status}`,
      );
    return response;
  }
  refresh() {
    return new HFSource(this.address, this.token, this.fetcher).open();
  }
  async open() {
    const { id, type, revision } = this.address;
    this.api = `${HUB}/api/${type === 'dataset' ? 'datasets' : type === 'space' ? 'spaces' : 'models'}/${id}`;
    const metadata = await (await this.request(`${this.api}/revision/${segment(revision)}`)).json();
    if (!/^[a-f\d]{40}$/i.test(metadata.sha))
      throw Error('Hugging Face did not return a pinned commit');
    this.commit = metadata.sha;
    let url = `${this.api}/tree/${this.commit}?recursive=true&limit=1000`;
    this.entries = new Map();
    const seen = new Set();
    while (url) {
      if (seen.has(url) || !url.startsWith(`${this.api}/tree/${this.commit}?`))
        throw Error('Invalid repository pagination');
      seen.add(url);
      const response = await this.request(url),
        page = await response.json();
      if (!Array.isArray(page)) throw Error('Invalid repository tree');
      for (const entry of page) {
        if (entry.type === 'file') {
          checkedPath(entry.path);
          this.entries.set(entry.path, entry);
        }
        if (this.entries.size > 10000)
          throw Error('Repository exceeds the 10,000-file reading limit');
      }
      const next = response.headers.get('Link')?.match(/<([^>]+)>;\s*rel="?next"?/);
      if (page.length >= 1000 && !next)
        throw Error('Repository listing may be incomplete; pagination headers are unavailable');
      url = next ? new URL(next[1], HUB).href : null;
    }
    return this;
  }
  url(path) {
    checkedPath(path);
    return `${HUB}/${this.address.type === 'dataset' ? 'datasets/' : this.address.type === 'space' ? 'spaces/' : ''}${this.address.id}/resolve/${this.commit}/${path.split('/').map(segment).join('/')}`;
  }
  async bytes(path, limit = 1024 * 1024) {
    checkedPath(path);
    const entry = this.entries.get(path);
    if (!entry || !Number.isSafeInteger(entry.size) || entry.size < 0)
      throw Error('File is missing or excluded from this repository');
    if (entry.size > limit)
      throw Error(`File exceeds the ${Math.round(limit / 1024 / 1024)} MiB reading limit`);
    if (!this.cache.has(path) && this.cachedBytes + entry.size > 64 * 1024 * 1024)
      throw Error('Repository reads exceed the 64 MiB session limit; refresh to reset');
    if (!this.cache.has(path))
      this.cache.set(
        path,
        this.read(path, limit).catch((error) => {
          this.cache.delete(path);
          throw error;
        }),
      );
    const result = await this.cache.get(path);
    if (result.byteLength > limit) throw Error('File exceeds the reading limit');
    return result;
  }
  async read(path, limit) {
    const response = await this.request(this.url(path));
    if (Number(response.headers.get('Content-Length')) > limit)
      throw Error('File exceeds the reading limit');
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw Error('File exceeds the reading limit');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    if (this.cachedBytes + size > 64 * 1024 * 1024) throw Error('Repository reads exceed the 64 MiB session limit');
    this.cachedBytes += size;
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }
  async text(path) {
    return new TextDecoder('utf-8', { fatal: true }).decode(await this.bytes(path));
  }
}
