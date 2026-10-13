// Verifies the caller's Supabase access token and loads their profile (role / active).
const { admin } = require('./supabase');

async function authenticate(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) { const e = new Error('Not signed in.'); e.status = 401; throw e; }
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data || !data.user) { const e = new Error('Session expired — please log in again.'); e.status = 401; throw e; }
  const { data: profile, error: pErr } = await admin().from('rewire_user_profiles')
    .select('id, name, role, active, calling_access').eq('id', data.user.id).single();
  if (pErr || !profile || profile.active === false) { const e = new Error('Your account is not active.'); e.status = 403; throw e; }
  return profile;
}

module.exports = { authenticate };
