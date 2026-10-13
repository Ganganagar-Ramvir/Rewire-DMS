// Supabase helpers (server side only — uses the service_role key, never sent to the browser).
const { createClient } = require('@supabase/supabase-js');

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Env SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.');
  return { url, key };
}

let _admin = null;
function admin() {
  if (_admin) return _admin;
  const { url, key } = cfg();
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

// Raw PostgREST GET (same query strings the old Apps Script code used). Returns parsed JSON.
async function rest(pathAndQuery) {
  const { url, key } = cfg();
  const resp = await fetch(url + '/rest/v1/' + pathAndQuery, { headers: { Authorization: 'Bearer ' + key, apikey: key } });
  const text = await resp.text();
  if (!resp.ok) throw new Error('Supabase fetch failed (' + pathAndQuery.split('?')[0] + '): ' + text);
  return JSON.parse(text);
}

module.exports = { admin, rest, cfg };
