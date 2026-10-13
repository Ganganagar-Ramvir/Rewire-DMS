// Google Drive upload (replaces Drive.gs uploadFileToDrive).
// Auth: service account (GOOGLE_SERVICE_ACCOUNT_JSON) — or OAuth refresh token of your own account.
// IMPORTANT: a service account has NO storage quota of its own. Point DRIVE_ROOT_FOLDER_ID at a folder inside a
// SHARED DRIVE and add the service-account email there as "Content manager" (supportsAllDrives is used below).
const { google } = require('googleapis');
const { Readable } = require('stream');

let _drive = null;
function driveClient() {
  if (_drive) return _drive;
  let auth;
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
    if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
    const creds = JSON.parse(raw);
    auth = new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
  } else {
    throw new Error('Google Drive is not configured (set GOOGLE_SERVICE_ACCOUNT_JSON or the GOOGLE_OAUTH_* variables).');
  }
  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// One Drive folder per vehicle number / partner name, created on first use.
async function findOrCreateFolder(name) {
  const drive = driveClient();
  const parent = process.env.DRIVE_ROOT_FOLDER_ID;
  if (!parent) throw new Error('Env DRIVE_ROOT_FOLDER_ID not set.');
  const clean = String(name || 'Unsorted').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Unsorted';
  const q = `name='${esc(clean)}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = async () => (await drive.files.list({
    q, fields: 'files(id,createdTime)', orderBy: 'createdTime', pageSize: 10,
    supportsAllDrives: true, includeItemsFromAllDrives: true,
  })).data.files || [];
  let found = await list();
  if (found.length) return found[0].id;
  await drive.files.create({
    requestBody: { name: clean, mimeType: 'application/vnd.google-apps.folder', parents: [parent] },
    fields: 'id', supportsAllDrives: true,
  });
  found = await list();                     // re-query: if two uploads raced, always use the OLDEST folder
  return found[0].id;
}

async function uploadFileToDrive(base64, fileName, mimeType, folderName) {
  if (!base64) throw new Error('Empty file.');
  const drive = driveClient();
  const folderId = await findOrCreateFolder(folderName);
  const safeName = String(fileName || 'file').replace(/[\\/:*?"<>|]/g, '_');
  const res = await drive.files.create({
    requestBody: { name: safeName, parents: [folderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(Buffer.from(base64, 'base64')) },
    fields: 'id', supportsAllDrives: true,
  });
  const id = res.data.id;
  try {   // "anyone with the link can view" — the app shows thumbnails/previews straight from Drive URLs
    await drive.permissions.create({ fileId: id, requestBody: { role: 'reader', type: 'anyone' }, supportsAllDrives: true });
  } catch (e) { console.error('Could not set link-sharing on ' + id + ': ' + e.message); }
  return 'https://drive.google.com/file/d/' + id + '/view?usp=sharing';   // same URL shape the app already parses (/d/<id>)
}

module.exports = { uploadFileToDrive };
