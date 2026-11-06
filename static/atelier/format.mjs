// Portable file interpretation. No network, DOM, storage, or provider imports.
export const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function yaml(text) {
  let nodes = 0;
  return globalThis.jsyaml.load(text, {
    schema: globalThis.jsyaml.JSON_SCHEMA,
    listener: (event, state) => {
      if (event === 'close' && state.anchor !== null)
        throw Error('YAML aliases and anchors are unsupported');
      if (event === 'open' && ++nodes > 10000) throw Error('YAML exceeds the reading limit');
    },
  });
}
export function checkedPath(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    /[\\\x00-\x1f]/.test(path) ||
    path.startsWith('/') ||
    path.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw Error('Invalid repository path');
  return path;
}
export function research(path) {
  const parts = path.split('/');
  return (
    path.endsWith('.md') &&
    !parts.some((p) => p.startsWith('.')) &&
    !['agents', 'skills'].includes(parts[0]) &&
    !['AGENTS.MD', 'CLAUDE.MD', 'SKILL.MD'].includes(parts.at(-1).toUpperCase())
  );
}
export function localLink(document, url) {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(url)) return null;
  const [pathname, anchor = ''] = url.split('#');
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.startsWith('/') || path.includes('\\') || path.includes('?')) return null;
  const parts = document.split('/').slice(0, -1);
  for (const part of path.split('/')) {
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return { path: path ? parts.join('/') : document, anchor };
}
export function describe(source, path) {
  let text = source;
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4);
    if (
      end !== -1 &&
      yaml(text.slice(4, end)) instanceof Object &&
      !Array.isArray(yaml(text.slice(4, end)))
    )
      text = '\n'.repeat(text.slice(0, end + 5).split('\n').length - 1) + text.slice(end + 5);
  }
  const md = globalThis.markdownit('commonmark', { html: true }).enable('table');
  const tokens = md.parse(text, {}),
    headings = [],
    threads = [],
    tasks = [],
    warnings = [];
  const ids = new Set();
  let context = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const title = tokens[i + 1].content,
        base =
          title
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_-]+/gu, '-')
            .replace(/^-|-$/g, '') || 'section';
      let id = base,
        n = 1;
      while (ids.has(id)) id = `${base}-${++n}`;
      ids.add(id);
      token.attrSet('id', id);
      headings.push({ id, title, level: Number(token.tag.slice(1)) });
    }
    if (token.type === 'html_block') {
      try {
        const match = token.content.match(/^<!-- thread\n([\s\S]*?)\n-->\s*$/);
        if (!match) throw Error('Unstructured HTML');
        const value = yaml(match[1]);
        if (
          !value ||
          Object.keys(value).sort().join() !== 'id,messages,status' ||
          typeof value.id !== 'string' ||
          !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value.id) ||
          !['open', 'resolved'].includes(value.status) ||
          !Array.isArray(value.messages) ||
          !value.messages.length ||
          value.messages.some(
            (m) =>
              !m ||
              Object.keys(m).sort().join() !== 'author,text' ||
              ['author', 'text'].some((k) => typeof m[k] !== 'string' || !m[k].trim()),
          ) ||
          threads.some((t) => t.id === value.id)
        )
          throw Error('Invalid thread');
        token.thread = { ...value, line: token.map[0] + 1, context: context.slice(0, 240) };
        threads.push(token.thread);
      } catch {
        warnings.push({
          line: token.map[0] + 1,
          message: 'Unrecognized or invalid HTML; showing its source.',
        });
      }
    }
    if (token.type === 'inline') {
      context = token.content;
      const figure = token.content.trim().match(/^::figure\{src="([^"\n]+)"\}$/);
      if (figure) context = `Figure: ${figure[1]}`;
      if (tokens[i - 2]?.type === 'list_item_open') {
        const task = token.content.match(/^\[([ xX])\]\s+([\s\S]*)/);
        if (task) {
          token.task = task[1].toLowerCase() === 'x';
          tasks.push({
            done: token.task,
            text: task[2].replace(/<!--.*?-->/g, '').trim(),
            claim: task[2].match(/<!-- claimed:\s*([^<>]+?)\s*-->/)?.[1] || null,
          });
        }
      }
    }
    if (['fence', 'code_block'].includes(token.type)) context = token.content;
  }
  return {
    md,
    tokens,
    path,
    title: headings[0]?.title || path.split('/').at(-1).replace(/\.md$/, ''),
    headings,
    threads,
    tasks,
    warnings,
  };
}
export function metadata(parsed) {
  const { path, title, headings, threads, tasks, warnings } = parsed;
  return { path, title, headings, threads, tasks, warnings };
}
