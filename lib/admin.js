// ADMIN: create a Supabase Auth user + profile row (port of Admin.gs createSupabaseUser). Admin role only (checked in api/rpc.js).
const { cfg } = require('./supabase');

async function createSupabaseUser(userId, name, role, password, managerId, managerEmail, phone) {
  const { url, key } = cfg();
  const email = userId + '@rewiredms.app';
  const headers = { Authorization: 'Bearer ' + key, apikey: key, 'Content-Type': 'application/json' };
  const authResp = await fetch(url + '/auth/v1/admin/users', { method: 'POST', headers, body: JSON.stringify({ email, password, email_confirm: true }) });
  const authData = await authResp.json();
  if (!authResp.ok) throw new Error('Auth user creation failed: ' + (authData.msg || authData.message || JSON.stringify(authData)));
  const profile = { id: authData.id, user_id: userId, name, role };
  if (managerId) profile.manager_id = managerId;
  if (managerEmail) profile.manager_email = managerEmail;
  if (phone) profile.phone = phone;
  const pr = await fetch(url + '/rest/v1/rewire_user_profiles', { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, headers), body: JSON.stringify(profile) });
  if (!pr.ok) throw new Error('Profile creation failed: ' + (await pr.text()));
  return { success: true, userId, email };
}
module.exports = { createSupabaseUser };
