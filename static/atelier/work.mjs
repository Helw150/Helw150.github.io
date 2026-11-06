// Portable agent work records. No DOM, storage, or provider dependencies.
import { yaml } from './format.mjs';
export const isWorkRecord = path => path.startsWith('agents/work/') && path.endsWith('.md') && path.split('/').at(-1) !== 'README.md';
export function parseWork(text, path) {
  let fields = {}, body = text;
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4);
    if (end < 0) throw Error('Unclosed work-record frontmatter');
    fields = yaml(text.slice(4,end));
    if (!fields || Array.isArray(fields) || !['agent','status','updated'].every(key=>Object.hasOwn(fields,key)) || Object.keys(fields).some(key=>!['agent','status','updated','branches'].includes(key))) throw Error('Work metadata needs agent, status, updated, and optional branches');
    if (typeof fields.agent !== 'string' || !fields.agent.trim() || !['active','blocked','review','done'].includes(fields.status)) throw Error('Invalid work agent or status');
    if (typeof fields.updated !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(fields.updated) || !Number.isFinite(Date.parse(fields.updated))) throw Error('Work updated needs an ISO 8601 timestamp with timezone');
    body = text.slice(end+5);
  }
  const branches = Object.hasOwn(fields, 'branches') ? fields.branches : [];
  if (!Array.isArray(branches)) throw Error('Work branches must be a list');
  for (const branch of branches) {
    if (!branch || !['repo','base','head'].every(key=>Object.hasOwn(branch,key)) || Object.keys(branch).some(key=>!['repo','base','head','base_revision','head_revision'].includes(key))) throw Error('Branch needs repo, base, head, and optional pinned revisions');
    if (typeof branch.repo !== 'string' || !/^(https:\/\/|ssh:\/\/|git@)[^\s]+$/.test(branch.repo)) throw Error('Branch repo must be an explicit Git remote URL');
    for (const key of ['base','head']) {
      const ref=branch[key];
      if (typeof ref !== 'string' || !ref || /[\s\x00-\x1f~^:?*\[\\]|\.\.|@\{/.test(ref) || /^[/-]/.test(ref) || /[/.]$|\.lock$/.test(ref)) throw Error('Invalid branch ref');
    }
    for (const key of ['base_revision','head_revision']) if (Object.hasOwn(branch,key) && (typeof branch[key] !== 'string' || !/^([a-f\d]{40}|[a-f\d]{64})$/i.test(branch[key]))) throw Error('Pinned branch revisions must be full Git commit hashes');
  }
  const tokens=globalThis.markdownit('commonmark').parse(body,{}), lines=body.split('\n');
  const stem=path.split('/').at(-1).replace(/\.md$/,''), sections=new Map();let title=stem, firstParagraph='';
  for(let i=0;i<tokens.length;i++) {
    const token=tokens[i];
    if(token.type==='heading_open') {
      const name=tokens[i+1].content;
      if(token.tag==='h1' && title===stem)title=name;
      if(token.tag==='h2' && ['tl;dr','work log'].includes(name.toLowerCase())) {
        if(sections.has(name.toLowerCase()))throw Error('Duplicate work-record section');
        sections.set(name.toLowerCase(),token.map);
      }
    }
    if(token.type==='paragraph_open' && !firstParagraph)firstParagraph=lines.slice(...token.map).join('\n').trim();
  }
  const summarySection=sections.get('tl;dr'), logSection=sections.get('work log'), hasFields=Object.keys(fields).length>0;
  if(hasFields && (!summarySection || !logSection || summarySection[0]>=logSection[0]))throw Error('Work record needs TL;DR before Work log');
  const summary=summarySection && logSection ? lines.slice(summarySection[1],logSection[0]).join('\n').trim() : firstParagraph;
  const log=logSection ? lines.slice(logSection[1]).join('\n').trim() : body.trim();
  if(hasFields && (!summary || !log))throw Error('Work summary and log must be nonempty');
  return {path,title,agent:fields.agent ?? null,status:fields.status || 'unknown',updated:fields.updated ?? null,branches,summary_source:summary,log_source:log,legacy:!hasFields};
}
