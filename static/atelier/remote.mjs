// Browser controller: connect a repository Model to the existing View API.
import { HFSource, repoAddress } from './hf.mjs';
import { Repository } from './repository.mjs';
import { renderDocument } from './markdown.mjs';
import { escape } from './format.mjs';
import { readTable } from './table.mjs';
import {isWorkRecord, parseWork} from './work.mjs';
let repository, resolveFirst;
const ready = new Promise((resolve) => {
  resolveFirst = resolve;
});
const urls = new Map();
export async function openSource(source) {
  const candidate = await new Repository(source).open();
  const snapshot = await candidate.snapshot();
  for (const record of snapshot.work || []) if (!record.error) record.summary_html = renderDocument(record.summary_source, record.path, []).html;
  repository = candidate;
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  snapshotCache = snapshot;
  resolveFirst();
  return snapshot;
}
let snapshotCache;
export async function api(endpoint, path) {
  await ready;
  if (endpoint === '/api/project') {
    if (!snapshotCache) await openSource(await repository.source.refresh());
    const snapshot = snapshotCache;
    snapshotCache = null;
    return snapshot;
  }
  if (endpoint === '/api/document') {
    const source = await repository.text(path);
    if (isWorkRecord(path)) { const work = parseWork(source,path); return {path,title:work.title,work,summary_html:renderDocument(work.summary_source,path,[]).html}; }
    return path.endsWith('.md')
      ? renderDocument(source, path, repository.figures)
      : {
          path,
          title: path.split('/').at(-1),
          html: `<pre class="source"><code>${escape(source)}</code></pre>`,
          headings: [],
          threads: [],
          tasks: [],
          warnings: [],
        };
  }
  if (endpoint === '/api/table') return readTable(repository, path);
  throw Error('Unknown reader request');
}
export async function asset(path) {
  if (urls.has(path)) return urls.get(path);
  const bytes = await repository.bytes(path, 16 * 1024 * 1024);
  let mime;
  if (path.endsWith('.png') && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    mime = 'image/png';
  else if (path.endsWith('.svg')) {
    const text = new TextDecoder().decode(bytes);
    if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(text))
      throw Error('Unsupported SVG definitions');
    const document = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg')
      throw Error('Invalid SVG');
    for (const element of document.querySelectorAll('*')) {
      if (/^(script|foreignobject|style|image|animate.*|set)$/i.test(element.localName))
        throw Error('Active or linked SVG content is unsupported');
      for (const attribute of element.attributes) {
        if (
          /^on/i.test(attribute.localName) ||
          (['href', 'src'].includes(attribute.localName) && !attribute.value.startsWith('#')) ||
          [...attribute.value.matchAll(/url\s*\((.*?)\)/gi)].some(
            (match) =>
              !match[1]
                .trim()
                .replace(/^['"]|['"]$/g, '')
                .startsWith('#'),
          ) ||
          /\\|@import/i.test(attribute.value)
        )
          throw Error('External or active SVG content is unsupported');
      }
    }
    mime = 'image/svg+xml';
  } else throw Error('Only local SVG and PNG images are supported');
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  urls.set(path, url);
  return url;
}

window.atelierAPI = api;
window.atelierAsset = asset;
const form = document.querySelector('#repo-form'),
  panel = document.querySelector('#connection-panel'),
  error = document.querySelector('#connection-error'),
  home = document.querySelector('#atelier-home');
const recentKey = 'atelier.recent-workspaces';

function recentWorkspaces() {
  try {
    const saved = JSON.parse(localStorage.getItem(recentKey) || '[]');
    return saved.map(({ id, type, revision }) => repoAddress(id, type, revision)).slice(0, 6);
  } catch {
    return [];
  }
}

function rememberWorkspace(address) {
  const recent = recentWorkspaces().filter(entry =>
    entry.id !== address.id || entry.type !== address.type || entry.revision !== address.revision);
  try {
    localStorage.setItem(recentKey, JSON.stringify([address, ...recent].slice(0, 6)));
  } catch {
    // Browsing still works when storage is unavailable.
  }
}

function showHome() {
  const list = document.querySelector('#home-recent-list');
  for (const address of recentWorkspaces()) {
    if (address.id === 'WillHeld/atelier-demo' && address.type === 'dataset' && address.revision === 'main') continue;
    const query = new URLSearchParams({ repo: address.id, type: address.type, revision: address.revision });
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'home-workspace';
    link.href = '?' + query + '#/overview';
    const name = document.createElement('strong');
    name.textContent = address.id;
    const branch = document.createElement('small');
    branch.textContent = address.revision;
    link.append(name, branch);
    item.append(link);
    list.append(item);
  }
  document.querySelector('#home-recent').hidden = !list.childElementCount;
  document.querySelector('#home-open').append(form);
  home.hidden = false;
}

const params = new URLSearchParams(location.search);
form.elements.repo.value = params.get('repo') || '';
form.elements.revision.value = params.get('revision') || 'main';
form.elements.type.value = params.get('type') || 'dataset';
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  form.querySelector('button').disabled = true;
  try {
    const wasConnected = Boolean(repository);
    const address = repoAddress(
      form.elements.repo.value,
      form.elements.type.value,
      form.elements.revision.value,
    );
    const token = form.elements.token.value.trim();
    const source = await new HFSource(address, token).open();
    await openSource(source);
    if (!token) rememberWorkspace(address);
    form.elements.token.value = '';
    home.hidden = true;
    panel.append(form);
    panel.close();
    document.body.classList.remove('connecting');
    const url = new URL(location.href);
    url.searchParams.set('repo', address.id);
    url.searchParams.set('type', address.type);
    url.searchParams.set('revision', address.revision);
    if (wasConnected) url.hash = '#/overview';
    history.replaceState(null, '', url);
    window.dispatchEvent(new Event('atelier-source-change'));
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    form.querySelector('button').disabled = false;
  }
});
document.querySelector('#change-repo').addEventListener('click', () => panel.showModal());
panel.addEventListener('cancel', (event) => {
  if (!repository) event.preventDefault();
});
const brand = document.querySelector('.sidebar .brand');
brand.href = './';
brand.setAttribute('aria-label', 'Atelier home');
brand.title = 'Atelier home';
showHome();
if (params.has('repo')) form.requestSubmit();
