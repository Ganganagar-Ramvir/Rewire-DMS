# REWIRE DMS — Node.js / Vercel

Data → Supabase (same project). Files → Google Drive. Server functions → `/api/rpc`. Same UI; `public/gas-shim.js` maps `google.script.run` to `/api/rpc`.

## Setup
1. `npm install`
2. Copy `.env.example` → set in Vercel (Project → Settings → Environment Variables):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON, one line), `DRIVE_ROOT_FOLDER_ID`
   - `SMTP_*`, `MAIL_FROM_NAME` (Gmail: app password)
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
   - `CRON_SECRET` (any random string)
3. **Drive**: service accounts have no storage quota → create the root folder inside a **Shared Drive**, add the service-account email as Content manager, put the folder ID in `DRIVE_ROOT_FOLDER_ID`. (Alternative: set `GOOGLE_OAUTH_*` refresh token to upload as your own account.)
4. Deploy: `vercel --prod` (or connect Git repo). Build runs `scripts/build.js` → `public/index.html`.

## Cron (IST)
- 09:00 `/api/cron/sale-reports` (03:30 UTC)
- 10:00 `/api/cron/daily-reports` (04:30 UTC)

## Notes
- Vercel body limit ~4.5 MB → keep uploads under ~3 MB (base64 overhead).
- Google Sheet export (`writeSentForPaymentToSheet`) is not supported; returns an error.
- Manifest slip PDF uses `@sparticuz/chromium` (first call is slow).
- Missing source files: put `JS-TableExport.html` in `src/html/` (build only warns without it). `src/login.html` and `public/icon.svg` are my replacements for Login.html / Icons.gs.
