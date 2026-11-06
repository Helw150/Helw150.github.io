import {githubCompare} from './branches.mjs';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fileRoute = path => `#/file/${encodeURIComponent(path)}`;
const number = value => Number(value).toLocaleString();
const state = {project: null, sequence: 0, document: null, threadFilter: 'open'};
const documentUrl = path => {
  const url = state.project?.google_docs?.[path]?.url;
  return url ? `#/documents?tab=${encodeURIComponent(new URL(url).searchParams.get('tab') || '')}` : fileRoute(path);
};
const documentTarget = () => '';

async function api(endpoint, path) {
  if (window.atelierAPI) return window.atelierAPI(endpoint, path);
  const response = await fetch(endpoint + (path ? `?path=${encodeURIComponent(path)}` : ''));
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not read this repository.');
  return result;
}

function route() {
  const hash = location.hash.slice(2) || 'overview';
  const [value, query] = hash.split('?');
  if (value.startsWith('file/')) {
    let path = value.slice(5);
    try { path = decodeURIComponent(path); } catch { /* Invalid escapes become an unavailable path. */ }
    return {view: 'file', path, anchor: new URLSearchParams(query).get('anchor'), local: new URLSearchParams(query).get('local') === '1'};
  }
  return {view: ['overview', 'documents', 'work', 'experiments', 'figures'].includes(value) ? value : 'overview', tab: new URLSearchParams(query).get('tab'), local: new URLSearchParams(query).get('local') === '1'};
}

function heading(title) {
  return `<div class="page-heading"><h1>${escape(title)}</h1></div>`;
}

function empty(title) {
  return `<p class="empty">${escape(title)}</p>`;
}

function setBreadcrumb(parts) {
  if (window.atelierAPI) parts = parts.slice(1);
  $('#breadcrumb').innerHTML = parts.map(part => `<span>${escape(part)}</span>`).join('<span class="separator">/</span>');
}

function imageAttributes(path) {
  return window.atelierAsset ? `data-asset="${escape(path)}"` : `src="/asset?path=${encodeURIComponent(path)}"`;
}
const assetObserver = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    const image = entry.target; assetObserver.unobserve(image);
    window.atelierAsset(image.dataset.asset).then(url => { if (image.isConnected) image.src = url; }).catch(error => {
      if (!image.isConnected) return;
      const notice = document.createElement('p'); notice.className = 'figure-pending'; notice.textContent = error.message; image.replaceWith(notice);
    });
  }
}, {rootMargin: '300px'});
function hydrateAssets() {
  if (!window.atelierAsset) return;
  for (const image of document.querySelectorAll('img[data-asset]:not([data-observed])')) {
    image.dataset.observed = '1'; assetObserver.observe(image);
  }
}
function figureCard(figure) {
  const source = escape(figure.source);
  const image = figure.available
    ? `<button class="figure-zoom" aria-label="Enlarge figure: ${escape(figure.title)}"><img class="figure-image" ${imageAttributes(figure.rendered)} alt="${escape(figure.takeaway || figure.title)}" loading="lazy"></button>`
    : `<div class="figure-pending"><span aria-hidden="true">↗</span><strong>Render pending</strong><p>${escape(figure.error || 'Generate the figure cache, then refresh.')}</p></div>`;
  return `<figure class="research-figure">${image}<figcaption><span>${escape(figure.title)}</span><a href="${fileRoute(figure.source)}">${source} ↗</a></figcaption></figure>`;
}

function documentList(documents, local = false) {
  return documents.map(doc => `<a class="document-row" href="${local ? fileRoute(doc.path) + '?local=1' : documentUrl(doc.path)}"${documentTarget(doc.path)}><span class="document-icon">▤</span><div><strong>${escape(doc.title)}</strong><small>${escape(doc.path)}</small></div><span class="row-meta">${state.project.google_docs?.[doc.path] ? `<span>${state.project.google_docs[doc.path].source_changed ? 'Snapshot outdated' : 'Google Docs'}</span>` : doc.open_threads ? `<span class="thread-count" title="Open threads in Git">◌ ${doc.open_threads}</span>` : ''}<span>↗</span></span></a>`).join('');
}

function renderSidebar() {
  const project = state.project;
  $('#project-name').textContent = project.directory;
  $('#revision').textContent = [project.git.branch, project.git.revision].filter(Boolean).join(' · ') || 'Working tree · no commit yet';
  if (window.atelierAPI) {
    $('#change-repo').textContent = project.directory;
    $('#change-repo').title = 'Change repository';
    $('#header-revision').textContent = project.git.revision;
  }
  $('#document-count').textContent = project.documents.length;
  $('#work-count').textContent = (project.work || []).filter(record => record.status !== 'done').length;
  $('#experiment-count').textContent = project.experiments.length;
  $('#figure-count').textContent = project.figures.length;
  const query = $('#search').value.toLowerCase().trim();
  const names = project.files.filter(path => !query ? path.endsWith('.md') && !path.startsWith('.agents/') : path.toLowerCase().includes(query));
  const current = route();
  $('#file-nav').innerHTML = names.length ? names.map(path => `<a class="file-link ${current.path === path ? 'active' : ''}" href="${documentUrl(path)}"${documentTarget(path)} title="${escape(path)}"><span>${path.endsWith('.parquet') ? '▦' : '·'}</span><span>${escape(path)}</span></a>`).join('') : '<p class="no-results">No matching files</p>';
  $('#file-nav').classList.toggle('has-query', Boolean(query));
  document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === current.view || (current.view === 'file' && link.dataset.view === (current.path.startsWith('agents/work/') ? 'work' : 'documents'))));
}

function renderOverview() {
  const p = state.project;
  const mainDocs = p.documents.filter(doc => !doc.path.startsWith('.agents/') && !['AGENTS.md', 'CLAUDE.md'].includes(doc.path));
  const tasks = p.tasks.filter(task => !task.done);
  setBreadcrumb([p.directory, 'Overview']);
  $('#main').innerHTML = `<div class="page overview">${heading(p.name)}
    <div class="stats"><a href="#/documents"><span>Documents</span><strong>${p.documents.length}</strong></a><a href="#/documents"><span>Open discussions</span><strong>${p.open_threads}</strong></a><a href="#/experiments"><span>Experiments</span><strong>${p.experiments.length}</strong><small>${p.experiments.filter(exp => exp.tables.length).length} with evidence</small></a><a href="#/figures"><span>Figures</span><strong>${p.figures.length}</strong><small>${p.figures.filter(fig => fig.available).length} rendered</small></a></div>
    <div class="overview-grid"><section><div class="section-heading"><h2>Research documents</h2><a href="#/documents">View all ↗</a></div><div class="document-list">${documentList(mainDocs) || empty('No documents')}</div></section>
    <section><div class="section-heading"><h2>Next steps</h2><span class="muted">${tasks.length} open</span></div><div class="task-list">${tasks.slice(0, 8).map(task => `<a href="${fileRoute(task.document)}"><span class="task-square"></span><div>${escape(task.text)}${task.claim ? `<small>Claimed by ${escape(task.claim)}</small>` : `<small>${escape(task.document)}</small>`}</div></a>`).join('') || empty('No open tasks')}</div></section></div>
    ${p.figures.length ? `<section class="overview-figures"><div class="section-heading"><h2>Figures</h2><a href="#/figures">All figures ↗</a></div><div class="figure-grid">${p.figures.slice(0, 2).map(figureCard).join('')}</div></section>` : ''}
    ${p.issues.length ? `<details class="issues"><summary>${p.issues.length} file format ${p.issues.length === 1 ? 'notice' : 'notices'}</summary>${p.issues.map(issue => `<p><a href="${fileRoute(issue.path)}">${escape(issue.path)}</a> ${escape(issue.message)}</p>`).join('')}</details>` : ''}
  </div>`;
}

function embeddedDocument(url, openUrl, changed = false, view = null) {
  document.body.classList.add('documents-mode');
  const embed = new URL(url);
  if (embed.origin !== 'https://docs.google.com') throw new Error('Invalid document view URL');
  const tabs = view?.tabs?.length > 1 ? `<nav class="document-tabs" aria-label="Documents">${view.tabs.map(tab => `<a href="${documentUrl(tab.path)}" ${new URL(tab.url).searchParams.get('tab') === embed.searchParams.get('tab') ? 'aria-current="page"' : ''}>${escape(tab.title)}</a>`).join('')}</nav>` : '';
  $('#main').innerHTML = `<section class="document-embed">${tabs}<div class="document-embed-tools">${view && !view.complete ? `<span class="projection-status">${view.connected} of ${view.total} documents exported</span>` : ''}${changed ? '<span class="muted">Snapshot outdated</span>' : ''}<a href="${escape(openUrl)}" target="_blank" rel="noopener noreferrer">Google Docs ↗</a><a href="#/documents?local=1">Local files</a></div><iframe title="Research documents" src="${escape(embed.href)}" allow="fullscreen" referrerpolicy="no-referrer"></iframe></section>`;
}

function renderDocuments() {
  setBreadcrumb([state.project.directory, 'Documents']);
  const current = route();
  const view = state.project.document_view;
  if (view && !current.local) {
    const url = new URL(view.embed_url);
    if (current.tab) url.searchParams.set('tab', current.tab);
    embeddedDocument(url.href, view.url, view.source_changed, view);
    return;
  }
  $('#main').innerHTML = `<div class="page">${heading('Documents')}${!view && !current.local && !window.atelierAPI ? '<p class="empty">Google Doc not connected.</p><a href="#/documents?local=1">Local files</a>' : `<div class="document-list">${documentList(state.project.documents, !window.atelierAPI) || empty('No documents')}</div>`}</div>`;
}

function workMeta(record) {
  const updated = record.updated ? new Date(record.updated).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'}) : 'Update not recorded';
  return `<div class="work-meta"><span class="work-status status-${escape(record.status)}">${escape({active:'Active',blocked:'Blocked',review:'In review',done:'Done',unknown:'Status not recorded'}[record.status] || record.status)}</span><span>${escape(record.agent || 'Agent not recorded')}</span><time datetime="${escape(record.updated || '')}">${escape(updated)}</time></div>`;
}
function branchLinks(record) {
  return (record.branches || []).map(branch => {
    const current = githubCompare(branch), pinned = githubCompare(branch,true);
    return `<div class="work-branch"><span class="branch-name">${escape(branch.base)} → ${escape(branch.head)}</span>${current ? `<a href="${escape(current)}" target="_blank" rel="noopener noreferrer">Compare ↗</a>` : `<span class="muted">${escape(branch.repo)}</span>`}${pinned ? `<a href="${escape(pinned)}" target="_blank" rel="noopener noreferrer">Recorded commits ↗</a>` : ''}</div>`;
  }).join('');
}
function renderWork() {
  setBreadcrumb([state.project.directory, 'Agent work']);
  const order = {active:0,blocked:1,review:2,unknown:3,done:4};
  const records = [...(state.project.work || [])].sort((a,b) => (order[a.status]??3)-(order[b.status]??3) || (b.updated || '').localeCompare(a.updated || ''));
  $('#main').innerHTML = `<div class="page work-page">${heading('Agent work')}${records.map(record => `<section class="work-record"><h2><a href="${fileRoute(record.path)}">${escape(record.title)}</a></h2>${workMeta(record)}${record.error ? `<p class="document-warning">${escape(record.error)}</p>` : `<div class="work-summary prose">${record.summary_html}</div>${branchLinks(record)}`}</section>`).join('') || empty('No work records')}</div>`;
  hydrateAssets();
}
function renderWorkRecord(doc) {
  const record = doc.work;
  $('#main').innerHTML = `<div class="page work-page"><a class="small-link" href="#/work">← Agent work</a>${heading(record.title)}${workMeta(record)}<h2>TL;DR</h2><div class="work-summary prose">${doc.summary_html}</div>${branchLinks(record)}<details class="work-log"><summary>Work log · agent context</summary><pre><code>${escape(record.log_source)}</code></pre></details></div>`;
  hydrateAssets();
}

function renderThreads() {
  const doc = state.document;
  if (!doc) return;
  const open = doc.threads.filter(thread => thread.status === 'open').length;
  const threads = doc.threads.filter(thread => state.threadFilter === 'all' || thread.status === 'open');
  $('#discussion-panel').innerHTML = `<div class="discussion-heading"><h2>Discussion</h2><span class="thread-count">${open} open</span></div><div class="segmented" aria-label="Thread filter"><button data-filter="open" aria-pressed="${state.threadFilter === 'open'}">Open</button><button data-filter="all" aria-pressed="${state.threadFilter === 'all'}">All threads</button></div>
  ${threads.map(thread => `<article class="thread-card ${thread.status === 'resolved' ? 'resolved' : ''}" id="card-${escape(thread.id)}"><a class="thread-context" href="${fileRoute(doc.path)}?anchor=${encodeURIComponent('thread-' + thread.id)}">${escape(thread.context || `Line ${thread.line}`)}</a><div class="thread-label"><span title="${escape(thread.id)}">${thread.status === 'resolved' ? 'Resolved' : 'Open'}</span></div>${thread.messages.map((message, index) => `<div class="message"><div class="avatar avatar-${index % 3}" aria-hidden="true">${escape(message.author.slice(0, 1).toUpperCase())}</div><div><strong>${escape(message.author)}</strong><p>${escape(message.text)}</p></div></div>`).join('')}</article>`).join('') || empty(doc.threads.length ? 'No open threads' : 'No discussion')}`;
}

async function renderFile(current, sequence) {
  setBreadcrumb([state.project.directory, current.path]);
  if (current.path.endsWith('.parquet')) {
    await renderTable(current.path, sequence);
    return;
  }
  const doc = await api('/api/document', current.path);
  if (sequence !== state.sequence) return;
  if (doc.work) { renderWorkRecord(doc); return; }
  state.document = doc;
  document.title = `${doc.title} · Atelier`;
  if (doc.google_doc && !current.local) {
    const url = new URL(doc.google_doc.url);
    url.pathname = url.pathname.replace(/\/edit$/, '/preview');
    embeddedDocument(url.href, doc.google_doc.url, doc.google_doc.source_changed);
    return;
  }
  $('#main').innerHTML = `<div class="reader-layout"><div class="document-column"><div class="document-topline"><span class="eyebrow">${escape(doc.path)}</span></div>${doc.warnings.length ? `<div class="document-warning">${doc.warnings.map(item => `Line ${item.line}: ${escape(item.message)}`).join('<br>')}</div>` : ''}<article class="prose">${doc.html}</article></div><aside class="reader-aside" aria-label="Document context">${doc.headings.length > 1 ? `<nav class="toc" aria-label="On this page"><div class="eyebrow">ON THIS PAGE</div>${doc.headings.filter(item => item.level > 1).map(item => `<a href="${fileRoute(doc.path)}?anchor=${encodeURIComponent(item.id)}">${escape(item.title)}</a>`).join('')}</nav>` : ''}<section id="discussion-panel" aria-label="Discussion"></section></aside></div>`;
  renderThreads();
  if (current.anchor) requestAnimationFrame(() => focusAnchor(current.anchor));
}

function focusAnchor(anchor) {
  const element = document.getElementById(anchor);
  if (!element) return;
  element.scrollIntoView({behavior: 'smooth', block: 'center'});
  if (anchor.startsWith('thread-')) selectThread(anchor.slice(7), false);
}

function selectThread(id, scroll = true) {
  const thread = state.document?.threads.find(item => item.id === id);
  if (thread?.status === 'resolved' && state.threadFilter !== 'all') {
    state.threadFilter = 'all'; renderThreads();
  }
  document.querySelectorAll('.thread-card, .thread-anchor').forEach(item => item.classList.remove('selected'));
  document.querySelectorAll('.thread-anchor').forEach(item => item.setAttribute('aria-pressed', 'false'));
  const card = document.getElementById(`card-${id}`);
  const anchor = document.getElementById(`thread-${id}`);
  card?.classList.add('selected'); anchor?.classList.add('selected');
  anchor?.setAttribute('aria-pressed', 'true');
  if (scroll) card?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function renderExperiments() {
  setBreadcrumb([state.project.directory, 'Experiments']);
  $('#main').innerHTML = `<div class="page">${heading('Experiments')}<div class="experiment-list">${state.project.experiments.map(exp => {
    const provenance = exp.provenance && typeof exp.provenance === 'object' ? exp.provenance : {};
    return `<section class="experiment-card"><div class="experiment-header"><div><h2><a href="${fileRoute(exp.readme)}">${escape(exp.id)} ↗</a></h2></div><span class="badge ${exp.tables.length ? 'available' : ''}">${escape(exp.status)}</span></div><div class="experiment-body"><div><h3>Configuration</h3><dl class="config">${exp.config && typeof exp.config === 'object' ? Object.entries(exp.config).map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(typeof value === 'object' ? JSON.stringify(value) : value)}</dd></div>`).join('') : '<p class="muted">No readable config.yaml.</p>'}</dl></div><div><h3>Evidence</h3>${exp.tables.length ? exp.tables.map(path => `<a class="evidence-link" href="${fileRoute(path)}"><span>▦ ${escape(path.split('/').at(-1))}</span><span>Preview ↗</span></a>`).join('') : '<p class="muted">No evidence yet.</p>'}<h3 class="provenance-title">Provenance</h3>${provenance.source_revision ? `<div class="revision-chip" title="${escape(provenance.source_revision)}">${escape(String(provenance.source_revision).slice(0, 12))}</div>${provenance.document ? `<p><a href="${fileRoute(provenance.document)}">${escape(provenance.document)} ↗</a></p>` : ''}<a class="small-link" href="${fileRoute(`experiments/${exp.id}/provenance.json`)}">Full provenance ↗</a>` : '<p class="muted">No provenance recorded.</p>'}</div></div></section>`;
  }).join('') || empty('No experiments')}</div></div>`;
}

async function renderTable(path, sequence) {
  const table = await api('/api/table', path);
  if (sequence !== state.sequence) return;
  const names = table.preview.length ? Object.keys(table.preview[0]) : table.columns.map(column => column.name).slice(0, 20);
  $('#main').innerHTML = `<div class="page">${heading(path.split('/').at(-1))}<div class="table-summary"><span><strong>${number(table.rows)}</strong> rows</span><span><strong>${table.columns.length}</strong> columns</span><span class="badge">Preview</span></div><div class="data-scroll"><table class="data-table"><thead><tr>${names.map(name => `<th>${escape(name)}<small>${escape(table.columns.find(column => column.name === name)?.type || '')}</small></th>`).join('')}</tr></thead><tbody>${table.preview.map(row => `<tr>${names.map(name => `<td>${row[name] === null ? '<span class="null">null</span>' : escape(typeof row[name] === 'object' ? JSON.stringify(row[name]) : row[name])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="footnote">${escape(table.preview.length ? `${table.preview.length} of ${number(table.rows)} rows · first row group${table.columns.length > 20 ? ' · first 20 columns' : ''}` : table.note)}</p><details class="schema"><summary>Full schema · ${table.columns.length} columns</summary><dl class="config">${table.columns.map(column => `<div><dt>${escape(column.name)}</dt><dd>${escape(column.type)}</dd></div>`).join('')}</dl></details></div>`;
}

function renderFigures() {
  setBreadcrumb([state.project.directory, 'Figures']);
  $('#main').innerHTML = `<div class="page">${heading('Figures')}<div class="figure-grid gallery">${state.project.figures.map(figure => `<section>${figureCard(figure)}<div class="figure-details"><a href="${fileRoute(figure.manifest)}">Manifest ↗</a>${(figure.data || []).map(path => `<a href="${fileRoute(path)}">▦ ${escape(path.split('/').at(-1))}</a>`).join('')}</div></section>`).join('') || empty('No figures')}</div></div>`;
}

async function render() {
  const sequence = ++state.sequence;
  state.document = null;
  document.title = `${state.project.directory} · Atelier`;
  renderSidebar();
  const current = route();
  document.body.classList.toggle('documents-mode', current.view === 'documents' && !current.local && Boolean(state.project.document_view));
  if (!current.anchor) window.scrollTo(0, 0);
  $('#main').innerHTML = '<div class="loading" role="status">Reading…</div>';
  try {
    if (current.view === 'file') await renderFile(current, sequence);
    else if (current.view === 'documents') renderDocuments();
    else if (current.view === 'work') renderWork();
    else if (current.view === 'experiments') renderExperiments();
    else if (current.view === 'figures') renderFigures();
    else renderOverview();
    hydrateAssets();
  } catch (error) {
    if (sequence !== state.sequence) return;
    $('#main').innerHTML = `<div class="page">${heading('File unavailable') + `<p>${escape(error.message)}</p>`}<a class="button" href="#/overview">Back to repository</a></div>`;
  }
}

async function loadProject() {
  $('#refresh').disabled = true;
  try {
    state.project = await api('/api/project');
    await render();
  } catch (error) {
    $('#main').innerHTML = `<div class="page">${heading('Repository unavailable') + `<p>${escape(error.message)}</p>`}</div>`;
  } finally { $('#refresh').disabled = false; }
}

$('#search').addEventListener('input', renderSidebar);
$('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#main').focus(); });
$('#refresh').addEventListener('click', loadProject);
window.addEventListener('atelier-source-change', loadProject);
window.addEventListener('hashchange', () => { if (state.project) render(); });
document.addEventListener('click', event => {
  const thread = event.target.closest('[data-thread]');
  if (thread) selectThread(thread.dataset.thread);
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.threadFilter = filter.dataset.filter; renderThreads(); }
  const image = event.target.closest('.figure-zoom')?.querySelector('.figure-image');
  if (image) {
    const dialog = document.createElement('dialog');
    dialog.className = 'figure-dialog'; dialog.setAttribute('aria-label', image.alt || 'Enlarged figure');
    const close = document.createElement('button'); close.textContent = 'Close ×'; close.className = 'button';
    const copy = image.cloneNode(); dialog.append(close, copy); document.body.append(dialog);
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
  }
});
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const message = document.createElement('div'); message.className = 'figure-pending';
  message.textContent = 'Image unavailable or unsupported. Check the rendered cache, then refresh.';
  image.replaceWith(message);
}, true);
if (!window.atelierAPI) loadProject();
