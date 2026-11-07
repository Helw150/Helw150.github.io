// Browser View: HTML rendering is independent of the repository transport.
import { describe, metadata, escape, localLink } from './format.mjs';
const route = (path, anchor = '') =>
  `#/file/${encodeURIComponent(path)}${anchor ? '?anchor=' + encodeURIComponent(anchor) : ''}`;
function figureHTML(figure) {
  const title = figure.title || figure.source.split('/').at(-1);
  const visual = figure.available
    ? `<button class="figure-zoom" aria-label="Enlarge figure: ${escape(title)}"><img class="figure-image" data-asset="${escape(figure.rendered)}" alt="${escape(figure.takeaway || title)}"></button>`
    : `<div class="figure-pending"><strong>Render pending</strong><p>${escape(figure.error || 'No matching figure manifest.')}</p></div>`;
  return `<figure class="research-figure">${visual}<figcaption><span>${escape(title)}</span><a href="${route(figure.source)}">${escape(figure.source)} ↗</a></figcaption></figure>`;
}
export function renderDocument(source, path, figures) {
  const parsed = describe(source, path),
    { md, tokens } = parsed,
    output = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const figure =
      token.type === 'paragraph_open' &&
      tokens[i + 1]?.content.trim().match(/^::figure\{src="([^"\n]+)"\}$/);
    if (figure) {
      output.push({
        type: 'html_block',
        content: figureHTML(figures.find((f) => f.source === figure[1]) || { source: figure[1] }),
      });
      i += 2;
      continue;
    }
    if (token.type === 'html_block')
      token.content = token.thread
        ? `<button class="thread-anchor" id="thread-${escape(token.thread.id)}" data-thread="${escape(token.thread.id)}" aria-pressed="false">◌ ${token.thread.messages.length} messages · ${token.thread.status}</button>`
        : `<pre class="format-warning"><code>${escape(token.content)}</code></pre>`;
    if (token.type === 'inline') {
      for (const child of token.children || []) {
        if (child.type === 'html_inline') {
          const claim = child.content.match(/^<!-- claimed:\s*([^\s<>]+)\s*-->$/);
          child.content = claim
            ? `<span class="claim">claimed · ${escape(claim[1])}</span>`
            : escape(child.content);
        }
        if (child.type === 'link_open') {
          const href = child.attrGet('href') || '',
            local = localLink(path, href);
          child.attrSet(
            'href',
            local ? route(local.path, local.anchor) : /^(https?:|mailto:)/i.test(href) ? href : '#',
          );
          if (!local) {
            child.attrSet('target', '_blank');
            child.attrSet('rel', 'noopener noreferrer');
          }
        }
        if (child.type === 'image') {
          const local = localLink(path, child.attrGet('src') || '');
          child.type = 'html_inline';
          child.content = local
            ? `<img data-asset="${escape(local.path)}" alt="${escape(child.content)}" loading="lazy">`
            : '<span class="muted">External image omitted</span>';
        }
      }
      if (token.task !== undefined && token.children?.[0]?.type === 'text') {
        token.children[0].content = token.children[0].content.replace(/^\[[ xX]\]\s+/, '');
        const box = new token.constructor('html_inline', '', 0);
        box.content = `<input type="checkbox" disabled aria-label="Task" ${token.task ? 'checked' : ''}>`;
        token.children.unshift(box);
      }
    }
    output.push(token);
  }
  return { ...metadata(parsed), html: md.renderer.render(output, md.options, {}) };
}
