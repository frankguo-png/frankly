# Railway cron setup

Vercel-style cron defined in `vercel.json` does *not* run on Railway. To get
auto-sync on Railway, add a separate cron service in the same Railway project
that calls the existing sync endpoints with the `CRON_SECRET`.

## One-time setup

1. **Railway dashboard → your project → New → Empty Service.**
   Name it something like `frankly-cron`.

2. **Settings → Source → Connect Repo** → same repo as the app.
   (The cron service just needs the `scripts/` folder; same image is fine.)

3. **Settings → Build → Custom Start Command:**
   ```
   bash scripts/railway-cron-sync.sh
   ```

4. **Settings → Service → Cron Schedule:**
   `0 */6 * * *`   (every 6 hours)

   For Rippling specifically you can set a separate cron service with weekly
   cadence (`0 8 * * 1`) since payroll headcount doesn't need 6-hour granularity
   — but the script syncs all three sources in one shot, so a single 6-hour
   schedule is fine.

5. **Variables tab — set on the cron service:**
   - `CRON_SECRET` — same value as on the main app service.
   - `RAILWAY_PUBLIC_DOMAIN` — Railway injects this automatically; verify it
     points to the *app* service's public domain, not the cron service's. If
     it doesn't, set it manually to the app's domain (e.g. `frankly.up.railway.app`).

6. **Deploy.** First run fires on the next cron tick.

## Verifying it works

Check the cron service's deploy logs after the first scheduled run. You should
see lines like:

```
[2026-04-28T18:00:00Z] plaid    POST https://frankly.up.railway.app/api/plaid/sync
[2026-04-28T18:00:01Z] plaid    HTTP 200  {"success":true,"sync":{"total":4,"succeeded":4,"failed":0}}
[2026-04-28T18:00:01Z] qbo      POST https://frankly.up.railway.app/api/qbo/sync
...
```

If you see HTTP 401, the `CRON_SECRET` doesn't match between services.
If you see HTTP 500 with a Rippling/Plaid error, the underlying API key is
the issue, not the cron — fix the env var on the *app* service.

## What if Railway dashboard cron isn't available

Some Railway plans don't expose dashboard cron. Two fallbacks:

- **External scheduler**: Cron-as-a-service like cron-job.org, hitting
  `https://your-app.up.railway.app/api/plaid/sync` etc. with the
  `Authorization: Bearer <CRON_SECRET>` header.
- **GitHub Actions** with `schedule:` trigger calling the same curl. Free for
  public repos, has a usage allowance for private.
