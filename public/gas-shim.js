/* Apps Script compatibility shim.
 * The app's code calls  google.script.run.withSuccessHandler(f).withFailureHandler(g).someServerFunction(args)
 * This turns every such call into  POST /api/rpc  {fn, args}  (server code lives in /lib + /api/rpc.js),
 * authenticated with the user's Supabase access token. No change needed in the existing HTML/JS files. */
(function () {
  async function accessToken() {
    try {
      if (typeof sb !== 'undefined' && sb.auth) {            // `sb` = the app's Supabase client (JS-Core.html)
        const r = await sb.auth.getSession();
        if (r && r.data && r.data.session) return r.data.session.access_token;
      }
    } catch (e) { /* fall through */ }
    try {
      for (const k of Object.keys(localStorage)) {
        if (/^sb-.*-auth-token$/.test(k)) {
          const v = JSON.parse(localStorage.getItem(k));
          return (v && (v.access_token || (v.currentSession && v.currentSession.access_token))) || null;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  async function call(fn, args) {
    const token = await accessToken();
    const resp = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify({ fn: fn, args: args }),
    });
    let json = null;
    try { json = await resp.json(); } catch (e) { /* non-JSON response */ }
    if (!resp.ok || !json || json.ok === false) {
      throw new Error((json && json.error) || ('Server error (' + resp.status + ')'));
    }
    return json.result;
  }

  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (prop === 'withFailureHandler') return function (f) { return runner(ok, f); };
        if (prop === 'withUserObject') return function () { return runner(ok, fail); };
        return function () {
          const args = Array.prototype.slice.call(arguments);
          call(String(prop), args)
            .then(function (r) { if (ok) ok(r); })
            .catch(function (e) { if (fail) fail(e); else console.error('Server call failed:', prop, e); });
        };
      },
    });
  }

  window.google = { script: { run: runner(null, null) } };
})();
