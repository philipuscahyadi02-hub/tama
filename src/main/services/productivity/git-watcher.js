// @ts-check
// Watches user-chosen git repos and awards bond XP for *your* new commits (PROD-2, BOND-1).
// First sight of a repo only records HEAD, so old history never counts. Repo list is per PC (device.json).
const path = require('path');
const { TOPICS } = require('../../bus-topics');

const POLL_MS = 60 * 1000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   device: import('../../platform/store/device').DeviceSettings,
 *   git: { isRepo: (d: string) => boolean, userEmail: (r: string) => Promise<string>,
 *          recentCommits: (r: string, n?: number) => Promise<Array<{ sha: string, email: string, time: number, subject: string }>> },
 * }} deps
 */
function createGitWatcher({ bus, device, git }) {
  /** @returns {{ repos: string[], lastSha: Record<string, string> }} */
  const cfg = () => ({ repos: [], lastSha: {}, ...(device.get().gitWatch || {}) });
  /** @param {Partial<{ repos: string[], lastSha: Record<string, string> }>} patch */
  const save = (patch) => device.patch('gitWatch', patch);

  /** Check one repo; returns how many new commits by the user were found. @param {string} repo */
  async function checkRepo(repo) {
    const commits = await git.recentCommits(repo, 30);
    if (!commits.length) return 0;
    const { lastSha } = cfg();
    const seen = lastSha[repo];
    save({ lastSha: { ...lastSha, [repo]: commits[0].sha } });
    if (!seen) return 0; // first look: baseline only
    const idx = commits.findIndex((c) => c.sha === seen);
    const fresh = idx < 0 ? commits.slice(0, 5) : commits.slice(0, idx); // history rewritten: count a few, not 30
    const me = await git.userEmail(repo);
    const mine = fresh.filter((c) => !me || c.email === me);
    for (const c of mine) {
      await bus.request(TOPICS.PET_AWARD, { source: 'commit' });
      bus.emit(TOPICS.PROD_COMMIT_SEEN, { repo: path.basename(repo), subject: c.subject.slice(0, 80) });
    }
    return mine.length;
  }

  async function pollAll() {
    for (const repo of cfg().repos) {
      try { await checkRepo(repo); } catch (e) { bus.emit(TOPICS.APP_ERROR, { topic: 'git-watch', message: String(/** @type {Error} */ (e).message) }); }
    }
  }

  /** @param {string} dir */
  async function add(dir) {
    const repo = path.resolve(String(dir || ''));
    if (!git.isRepo(repo)) return { error: `Not a git repo: ${repo}` };
    const { repos } = cfg();
    if (!repos.includes(repo)) save({ repos: [...repos, repo] });
    await checkRepo(repo); // set the baseline now
    return { ok: true, repo, repos: cfg().repos };
  }

  /** @param {string} dir */
  function remove(dir) {
    const repo = path.resolve(String(dir || ''));
    const { repos, lastSha } = cfg();
    const { [repo]: _drop, ...rest } = lastSha;
    save({ repos: repos.filter((r) => r !== repo), lastSha: rest });
    return { ok: true, repos: cfg().repos };
  }

  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  function start() {
    const offs = [
      bus.handle(TOPICS.PROD_WATCH_ADD, (/** @type {{path: string}} */ p) => add(p.path)),
      bus.handle(TOPICS.PROD_WATCH_REMOVE, (/** @type {{path: string}} */ p) => remove(p.path)),
      bus.handle(TOPICS.PROD_WATCH_LIST, () => ({ repos: cfg().repos })),
    ];
    timer = setInterval(pollAll, POLL_MS);
    return () => { if (timer) clearInterval(timer); for (const off of offs) off(); };
  }

  return { start, add, remove, pollAll, checkRepo };
}

module.exports = { createGitWatcher };
