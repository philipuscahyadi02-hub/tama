// @ts-check
// Gmail (GOOG-4): search, read, create drafts. There is NO send function anywhere (D-014): the user sends from Gmail.
const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** @param {string} s */
const b64urlDecode = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
/** @param {string} s */
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** @param {any[]} headers @param {string} name */
const header = (headers, name) => ((headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';

/** Plain text of a message (text/plain preferred, else stripped HTML). @param {any} payload */
function bodyText(payload) {
  /** @type {string[]} */ const plain = [];
  /** @type {string[]} */ const html = [];
  const walk = (/** @type {any} */ p) => {
    if (!p) return;
    if (p.body && p.body.data) (p.mimeType === 'text/html' ? html : p.mimeType === 'text/plain' ? plain : []).push(b64urlDecode(p.body.data));
    for (const c of p.parts || []) walk(c);
  };
  walk(payload);
  if (plain.length) return plain.join('\n');
  return html.join('\n').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

/** RFC 2047 encode a header value if it isn't plain ASCII. @param {string} v */
const encHeader = (v) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`);
/** Reject header injection (newlines) in addresses and subjects. @param {string} v @param {string} what */
function oneLine(v, what) {
  const s = String(v || '').trim();
  if (/[\r\n]/.test(s)) throw new Error(`${what} must be a single line.`);
  return s;
}

/** @param {ReturnType<typeof import('./api').createApi>} api */
function createGmail(api) {
  return {
    /** @param {{ query?: string, max?: number }} o */
    async search({ query = 'in:inbox', max = 10 } = {}) {
      const r = await api.request(`${BASE}/messages`, { query: { q: query, maxResults: Math.min(max, 25) } });
      const ids = (r.messages || []).map((/** @type {any} */ m) => m.id);
      const metas = await Promise.all(ids.map((/** @type {string} */ id) => api.request(`${BASE}/messages/${id}`, {
        query: { format: 'metadata' }, // all headers; we pick From / Subject / Date
      }).catch(() => null)));
      return metas.filter(Boolean).map((/** @type {any} */ m) => ({
        id: m.id, threadId: m.threadId, from: header(m.payload && m.payload.headers, 'From'),
        subject: header(m.payload && m.payload.headers, 'Subject'), date: header(m.payload && m.payload.headers, 'Date'),
        snippet: m.snippet || '', unread: (m.labelIds || []).includes('UNREAD'), important: (m.labelIds || []).includes('IMPORTANT'),
      }));
    },
    /** @param {{ messageId: string }} p */
    async read({ messageId }) {
      const m = await api.request(`${BASE}/messages/${encodeURIComponent(messageId)}`, { query: { format: 'full' } });
      const h = (m.payload && m.payload.headers) || [];
      return {
        id: m.id, threadId: m.threadId, from: header(h, 'From'), to: header(h, 'To'), subject: header(h, 'Subject'),
        date: header(h, 'Date'), body: bodyText(m.payload).slice(0, 8000),
      };
    },
    /** @param {{ to: string, subject: string, body: string, cc?: string, threadId?: string }} p */
    async createDraft(p) {
      const to = oneLine(p.to, 'To');
      if (!to) throw new Error('A draft needs a "to" address.');
      const lines = [`To: ${to}`];
      if (p.cc) lines.push(`Cc: ${oneLine(p.cc, 'Cc')}`);
      lines.push(`Subject: ${encHeader(oneLine(p.subject || '', 'Subject'))}`, 'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', String(p.body || ''));
      const r = await api.request(`${BASE}/drafts`, { json: { message: { raw: b64url(lines.join('\r\n')), ...(p.threadId ? { threadId: p.threadId } : {}) } } });
      return { draftId: r.id, messageId: r.message && r.message.id, link: 'https://mail.google.com/mail/u/0/#drafts' };
    },
    async profile() { return api.request(`${BASE}/profile`); },
  };
}

module.exports = { createGmail, bodyText, b64urlDecode };
