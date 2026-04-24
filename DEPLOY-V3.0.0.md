# Financial 101 Master — Version 3.0.0 Deployment

## What's New in v3.0.0

### Core Changes
- ✅ **Removed Account Switching** — Simplified to single-account workflow (Toy Theeranan)
- ✅ **Fixed Email Notifications** — Now sends to toy.theeranan@gmail.com
- ✅ **Google Drive Backup Completion** — Popup shows success message after upload
- ✅ **Fixed Cloudflare Configuration** — Corrected wrangler.toml TOML syntax
- ✅ **Version Log System** — New system logs app updates and shows welcome popup

### Files Modified
```
src/lib/
  ├── accounts.ts (simplified to single account)
  ├── store.ts (removed account switching)
  ├── version.ts (updated to v3.0.0)
  ├── version-log.ts (NEW - version tracking)
  └── email-templates.ts (removed accountSwitchEmail)

src/components/
  ├── layout/AppShell.tsx (removed account dropdown)
  ├── layout/BackupWidget.tsx (added completion popup)
  └── VersionUpdateNotification.tsx (NEW - update popup)

cloudflare/
  ├── email-worker.js (fixed email address)
  └── email-wrangler.toml (fixed main file reference)

wrangler.toml (fixed syntax error)
```

## Deployment Steps

### 1. Build the Application
```bash
cd financial-planner
npm run build
```

Expected output:
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages (15/15)
✓ Collecting build traces
✓ Finalizing page optimization
```

### 2. Deploy to Cloudflare Pages
```bash
npm run deploy
```

This will:
- Deploy the email worker to Cloudflare Workers
- Upload secrets (GMAIL_USER, GMAIL_APP_PASS, NOTIFY_TO)
- Deploy the Next.js app to Cloudflare Pages

### 3. Verify Deployment
- Check https://financeplan-th.pages.dev loads successfully
- Login and verify no errors in console
- Version notification popup should appear on first load
- Click "Sync Now" in backup widget to test completion popup

## Version Log System

The app now tracks version updates:

**What it does:**
1. Detects when app version changes (stored in localStorage)
2. Shows a welcome popup with changelog on first load of new version
3. Stores version history with timestamps
4. Persists logs across browser sessions

**How it works:**
- File: `src/lib/version-log.ts` — Core logging logic
- Component: `src/components/VersionUpdateNotification.tsx` — UI popup
- Integrated in: `src/components/layout/AppShell.tsx`

**Testing the popup:**
```javascript
// In browser console:
localStorage.removeItem('financial-planner-version-logs');
location.reload();
// Popup should appear showing v3.0.0 changes
```

## Features Verified

### Email Notifications ✓
- Endpoint: https://email-notify.financial101.workers.dev
- Sends to: toy.theeranan@gmail.com
- Format: Login alerts with IP, location, browser info

### Backup System ✓
- Google Drive sync available
- "Sync Now" button with loading state
- Completion popup (green, 3 second auto-dismiss)
- Success message: "Backup uploaded to Google Drive"

### Single Account ✓
- Main account: Toy Theeranan (toy.theeranan@gmail.com)
- Admin role
- No account switching UI
- /accounts page still exists but not in navigation

## Rollback (if needed)

If issues occur, previous version was:
- App: v1.0.1 (2025-04-14)
- Branch/commit: [reference previous deploy]

```bash
git revert HEAD  # or specific commit
npm run build && npm run deploy
```

## Post-Deployment Checklist

- [ ] App loads at https://financeplan-th.pages.dev
- [ ] Version 3.0.0 displays in sidebar version panel
- [ ] Popup appears on first load with changelog
- [ ] Account dropdown removed from sidebar
- [ ] Backup "Sync Now" shows completion popup
- [ ] Email worker responds to login events
- [ ] No console errors

## Support

If deployment fails:
1. Check build errors: `npm run build`
2. Verify secrets: `wrangler secret list`
3. Check Cloudflare Pages build logs
4. Review email worker: `wrangler tail email-notify`

---

**Deployed:** 2026-04-15  
**Version:** 3.0.0  
**Status:** Ready for production
