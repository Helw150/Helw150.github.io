// GitHub-specific comparison links belong to the View, not the work-record format.
export function githubCompare(branch, pinned = false) {
  let remote;
  try { remote = new URL(branch.repo); } catch { return null; }
  if (remote.protocol !== 'https:' || remote.hostname !== 'github.com' || remote.username || remote.password || remote.search || remote.hash) return null;
  const path = remote.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '');
  if (!/^\/[\w.-]+\/[\w.-]+$/.test(path)) return null;
  const base = pinned ? branch.base_revision : branch.base;
  const head = pinned ? branch.head_revision : branch.head;
  if (typeof base !== 'string' || typeof head !== 'string' || !base || !head) return null;
  return `https://github.com${path}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
}
