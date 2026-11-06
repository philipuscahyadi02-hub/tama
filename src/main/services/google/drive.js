// @ts-check
// Drive, Docs and Sheets (GOOG-5..7, PORT-6). Everything Tama creates goes into the "Tama Drafts" folder.
// No delete or share functions exist. Backups live in the hidden appDataFolder (drive.appdata scope).
const { mdToHtml, mdToText } = require('./markdown');

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const DOCS = 'https://docs.googleapis.com/v1/documents';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const FOLDER_NAME = 'Tama Drafts';
const MIME = {
  folder: 'application/vnd.google-apps.folder',
  doc: 'application/vnd.google-apps.document',
  sheet: 'application/vnd.google-apps.spreadsheet',
};

/** Drive query string literal. @param {string} s */
const lit = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** One multipart/related upload body. @param {any} meta @param {string | Buffer} media @param {string} type */
function multipart(meta, media, type) {
  const boundary = `tama${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.isBuffer(media) ? media : Buffer.from(media, 'utf8'), Buffer.from(`\r\n--${boundary}--`, 'utf8')]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

/**
 * @param {ReturnType<typeof import('./api').createApi>} api
 * @param {{ getFolderId: () => string | null, setFolderId: (id: string) => void }} cache
 */
function createDrive(api, cache) {
  async function draftsFolder() {
    const cached = cache.getFolderId();
    if (cached) {
      const ok = await api.request(`${DRIVE}/${cached}`, { query: { fields: 'id,trashed' } }).catch(() => null);
      if (ok && !ok.trashed) return cached;
    }
    const found = await api.request(DRIVE, { query: { q: `name = ${lit(FOLDER_NAME)} and mimeType = '${MIME.folder}' and trashed = false`, fields: 'files(id)', pageSize: 1 } });
    const id = (found.files && found.files[0] && found.files[0].id)
      || (await api.request(DRIVE, { json: { name: FOLDER_NAME, mimeType: MIME.folder }, query: { fields: 'id' } })).id;
    cache.setFolderId(id);
    return id;
  }

  /** @param {any} f */
  const slim = (f) => ({ id: f.id, name: f.name, type: f.mimeType, modified: f.modifiedTime, link: f.webViewLink });

  return {
    draftsFolder,
    /** @param {{ query?: string, max?: number }} o */
    async search({ query = '', max = 15 } = {}) {
      const q = [`trashed = false`, `mimeType != '${MIME.folder}'`, query ? `(name contains ${lit(query)} or fullText contains ${lit(query)})` : ''].filter(Boolean).join(' and ');
      const r = await api.request(DRIVE, { query: { q, pageSize: Math.min(max, 50), orderBy: 'modifiedTime desc', fields: 'files(id,name,mimeType,modifiedTime,webViewLink)' } });
      return (r.files || []).map(slim);
    },
    /** Text of a file: Docs as text, Sheets as CSV (first sheet), others if they're text. @param {{ fileId: string }} p */
    async read({ fileId }) {
      const meta = await api.request(`${DRIVE}/${encodeURIComponent(fileId)}`, { query: { fields: 'id,name,mimeType,webViewLink' } });
      const exportAs = meta.mimeType === MIME.doc ? 'text/plain' : meta.mimeType === MIME.sheet ? 'text/csv' : null;
      const r = exportAs
        ? await api.request(`${DRIVE}/${meta.id}/export`, { query: { mimeType: exportAs }, raw: true })
        : await api.request(`${DRIVE}/${meta.id}`, { query: { alt: 'media' }, raw: true });
      const text = await /** @type {Response} */ (r).text();
      return { ...slim(meta), text: text.slice(0, 20000), truncated: text.length > 20000 };
    },
    /** New Google Doc from Markdown, in Tama Drafts. @param {{ title: string, markdown: string }} p */
    async createDoc({ title, markdown }) {
      const folder = await draftsFolder();
      const { body, contentType } = multipart({ name: title || 'Untitled (Tama)', mimeType: MIME.doc, parents: [folder] }, mdToHtml(markdown || ''), 'text/html; charset=UTF-8');
      const r = await api.request(UPLOAD, { query: { uploadType: 'multipart', fields: 'id,name,mimeType,webViewLink' }, body, headers: { 'content-type': contentType } });
      return slim(r);
    },
    /** Append Markdown (as plain text) at the end of a Doc. @param {{ documentId: string, markdown: string }} p */
    async appendDoc({ documentId, markdown }) {
      const text = `\n${mdToText(markdown || '')}\n`;
      await api.request(`${DOCS}/${encodeURIComponent(documentId)}:batchUpdate`, { json: { requests: [{ insertText: { endOfSegmentLocation: {}, text } }] } });
      return { ok: true, documentId, link: `https://docs.google.com/document/d/${documentId}/edit` };
    },
    /** New spreadsheet with tabs; values are USER_ENTERED so formulas work. @param {{ title: string, sheets: Array<{ name: string, rows: any[][] }> }} p */
    async createSheet({ title, sheets }) {
      const tabs = (sheets && sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }]).slice(0, 20);
      const r = await api.request(SHEETS, { json: { properties: { title: title || 'Untitled (Tama)' }, sheets: tabs.map((t) => ({ properties: { title: String(t.name || 'Sheet').slice(0, 90) } })) } });
      const data = tabs.filter((t) => t.rows && t.rows.length).map((t) => ({ range: `'${String(t.name).replace(/'/g, "''")}'!A1`, values: t.rows }));
      if (data.length) await api.request(`${SHEETS}/${r.spreadsheetId}/values:batchUpdate`, { json: { valueInputOption: 'USER_ENTERED', data } });
      const folder = await draftsFolder();
      await api.request(`${DRIVE}/${r.spreadsheetId}`, { method: 'PATCH', query: { addParents: folder, removeParents: 'root', fields: 'id' }, json: {} }).catch(() => null);
      return { id: r.spreadsheetId, name: title, link: r.spreadsheetUrl };
    },
    /** @param {{ spreadsheetId: string, range: string, values: any[][] }} p */
    async writeRange({ spreadsheetId, range, values }) {
      const r = await api.request(`${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`, { method: 'PUT', query: { valueInputOption: 'USER_ENTERED' }, json: { values } });
      return { updatedRange: r.updatedRange, updatedCells: r.updatedCells };
    },
    /** @param {{ spreadsheetId: string, sheet: string, rows: any[][] }} p */
    async appendRows({ spreadsheetId, sheet, rows }) {
      const range = `'${String(sheet || 'Sheet1').replace(/'/g, "''")}'!A1`;
      const r = await api.request(`${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`, { query: { valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' }, json: { values: rows } });
      return { updatedRange: r.updates && r.updates.updatedRange };
    },

    // ---- appDataFolder (backups, device lease; PORT-6/7) ----
    /** @param {string} [prefix] */
    async appList(prefix = '') {
      const r = await api.request(DRIVE, { query: { spaces: 'appDataFolder', q: prefix ? `name contains ${lit(prefix)}` : undefined, fields: 'files(id,name,modifiedTime,size)', pageSize: 200, orderBy: 'modifiedTime desc' } });
      return (r.files || []).map((/** @type {any} */ f) => ({ id: f.id, name: f.name, modified: f.modifiedTime, size: Number(f.size || 0) }));
    },
    /** Create or replace an appData file by name. @param {string} name @param {Buffer|string} data @param {string} [existingId] */
    async appPut(name, data, existingId) {
      const type = 'application/octet-stream';
      if (existingId) {
        await api.request(`${UPLOAD}/${existingId}`, { method: 'PATCH', query: { uploadType: 'media' }, body: data, headers: { 'content-type': type } });
        return existingId;
      }
      const { body, contentType } = multipart({ name, parents: ['appDataFolder'] }, data, type);
      return (await api.request(UPLOAD, { query: { uploadType: 'multipart', fields: 'id' }, body, headers: { 'content-type': contentType } })).id;
    },
    /** @param {string} id @returns {Promise<Buffer>} */
    async appGet(id) {
      const r = await api.request(`${DRIVE}/${encodeURIComponent(id)}`, { query: { alt: 'media' }, raw: true });
      return Buffer.from(await /** @type {Response} */ (r).arrayBuffer());
    },
    /** Only for Tama's own hidden backups (old ones are pruned). Never used on the user's visible files. @param {string} id */
    async appRemove(id) { await api.request(`${DRIVE}/${encodeURIComponent(id)}`, { method: 'DELETE', raw: true }); },
  };
}

module.exports = { createDrive, multipart, FOLDER_NAME, MIME };
