# Vercel Deployment Setup Guide — Financial 101

Complete step-by-step guide to migrate from Cloudflare to Vercel with the 5-agent orchestrator.

---

## Phase 1: Prerequisites & Credentials (5 minutes)

### 1.1 Vercel Account & Project Creation

**Step 1:** Sign up or log in at https://vercel.com
- Create a free account if you don't have one
- Email: **techcraftlab.bkk@gmail.com** (your account email)

**Step 2:** Create a new project
1. Click **"Add New"** → **"Project"**
2. Import repository (or skip if deploying manually)
3. Project name: `financial-planner` (or `financial-101`)
4. Framework: **Next.js**
5. Create the project

**After creation, note these 3 values:**
```
VERCEL_PROJECT_ID = [from project Settings → General]
VERCEL_ORG_ID = [from account Settings → Team → Team ID]
VERCEL_REGION = [from project settings, e.g., iad1]
```

### 1.2 Vercel Personal Access Token

**Step 1:** Go to https://vercel.com/account/tokens
- Name: `financial-101-deploy`
- Scope: **Full Account**
- Click **"Create"**
- Copy the token (you'll only see it once)

```
VERCEL_TOKEN = your_token_here
```

### 1.3 Anthropic API Key

You have this already. Format:
```
ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxx
```

### 1.4 Gmail Setup (for deployment notifications)

**If you don't have a Gmail app password:**
1. Go to https://myaccount.google.com
2. **Security** (left sidebar)
3. Enable **2-Step Verification** if not already on
4. Go back to **Security**
5. Find **"App passwords"** (near 2FA)
6. Select: **Mail** + **Windows Computer**
7. Copy the 16-char password

```
GMAIL_USER = toy.theeranan@gmail.com (or your Gmail)
GMAIL_APP_PASS = xxxx xxxx xxxx xxxx (16-character app password)
NOTIFY_TO = recipient@email.com (or toy.theeranan@icloud.com)
```

---

## Phase 2: Vercel Environment Variables (3 minutes)

**Location:** https://vercel.com/projects/financial-planner/settings/environment-variables

### Add all 7 variables as **Production** only:

| Name | Value | Source |
|------|-------|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic console |
| `VERCEL_TOKEN` | `full_...` | Token you just created |
| `VERCEL_PROJECT_ID` | Project ID | Project Settings → General |
| `VERCEL_ORG_ID` | Team ID | Account Settings → Teams |
| `GMAIL_USER` | `your-email@gmail.com` | Your Gmail address |
| `GMAIL_APP_PASS` | `xxxx xxxx xxxx xxxx` | Gmail app password (16 chars) |
| `NOTIFY_TO` | `recipient@email.com` | Who gets deployment emails |

**⚠️ Important:** Do NOT check "Encrypt" — these need to be readable by the deployment scripts.

---

## Phase 3: Local Environment Setup (2 minutes)

Update your local `.env.local` file:

```bash
# Keep your local Cloudflare settings
CF_PROJECT_NAME=financeplan-th
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
NEXT_PUBLIC_GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/auth/google-drive

# Add Vercel deployment variables
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxx
VERCEL_TOKEN=full_xxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxx
VERCEL_ORG_ID=team_xxxxxxxxxx
GMAIL_USER=toy.theeranan@gmail.com
GMAIL_APP_PASS=xxxx xxxx xxxx xxxx
NOTIFY_TO=toy.theeranan@icloud.com
```

---

## Phase 4: Deploy! (1 minute)

### Option A: Run from command line
```bash
npm run deploy:notify
```

### Option B: Run the batch file (Windows)
```bash
DEPLOY.bat
```

### Option C: Manual verification
Before running, verify all env vars are set:
```bash
node -e "console.log({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.slice(0,10) + '...',
  VERCEL_TOKEN: process.env.VERCEL_TOKEN?.slice(0,10) + '...',
  VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  VERCEL_ORG_ID: process.env.VERCEL_ORG_ID,
  GMAIL_USER: process.env.GMAIL_USER,
})"
```

---

## Expected Output

If successful, you'll see:
```
[orchestrator] {"stage":"start","model":"haiku-4.5","agents":5}
[scout] Repository scan complete
[builder] Build successful
[deployer] Deployment URL: https://financial-planner-xxxxx.vercel.app
[verifier] Live site verified
[notifier] Email sent to recipient@email.com
[orchestrator] {"stage":"done","url":"https://...","notified":true}
```

---

## Troubleshooting

### ❌ "Missing env: ANTHROPIC_API_KEY"
→ Check Vercel Environment Variables page — make sure all 7 are set to "Production"

### ❌ "VERCEL_TOKEN invalid"
→ Regenerate at vercel.com/account/tokens and update in Vercel settings

### ❌ "Email not sent"
→ Check GMAIL_APP_PASS is exactly 16 characters with spaces (xxxx xxxx xxxx xxxx)

### ❌ "Deployment URL doesn't load"
→ Check Next.js build logs in Vercel dashboard

---

## After Successful Deployment

1. **Live URL**: Check your email for deployment URL, or go to vercel.com/projects/financial-planner
2. **Update DNS**: Point your domain to Vercel if needed
3. **Monitor**: Vercel dashboard shows logs and analytics
4. **Future deploys**: Just run `npm run deploy:notify` or push to main branch (if connected to Git)

---

**Need help?** Each section takes ~5 minutes. Total setup time: ~15 minutes.
