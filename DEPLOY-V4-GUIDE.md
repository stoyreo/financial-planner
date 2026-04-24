# DEPLOY-V4.0.0 - Deployment Guide

## Overview
The new **DEPLOY-V4.0.0.bat** is a multi-platform deployment script that builds on the V3 foundation and adds support for Vercel deployment alongside Cloudflare Pages.

## Features
✅ **Interactive Menu System** - Choose your deployment target  
✅ **Multi-Platform Support** - Deploy to Cloudflare, Vercel, or both  
✅ **Auto-Install** - Automatically installs Vercel CLI if needed  
✅ **Error Handling** - Validates each step before proceeding  
✅ **Notifications** - Sends deployment emails after successful deploys  
✅ **Production Deployment** - Uses `vercel --prod` for stable releases  

## How to Use

### 1. Run the Script
```bash
cd financial-planner
DEPLOY-V4.0.0.bat
```

### 2. Menu Options

When prompted, select your deployment option:

```
============================================
 DEPLOYMENT OPTIONS
============================================

1) Deploy to Cloudflare Pages
2) Deploy to Both (Cloudflare + Vercel)
3) Deploy to Vercel (Production)
4) Cancel
```

### 3. Option Details

| Option | Action | Result |
|--------|--------|--------|
| **1** | Build + Deploy to Cloudflare | `https://financeplan-th.pages.dev` |
| **2** | Build + Deploy to both platforms | Both URLs deployed |
| **3** | Build + Deploy to Vercel Production | Vercel dashboard URL |
| **4** | Cancel deployment | No changes |

## What Happens

### Build Phase
```
[1/4] Building application...
```
- Runs `npm run build`
- Creates optimized Next.js production build
- Validates build succeeds before proceeding

### Deployment Phase
```
[2/4] Deployment Menu
```
- Select your target platform(s)

### Deploy Execution
```
[3/4] Deploying to [platform]...
```
- **Cloudflare**: Runs `npm run deploy`
- **Vercel**: Runs `vercel --prod --yes`

### Post-Deploy
```
[Bonus] Sending deployment notification emails...
```
- Executes `node scripts/send-deployment-email.js`
- Notifies stakeholders of successful deployment

## Prerequisites

✅ npm installed and in PATH  
✅ Cloudflare Pages project configured (`financeplan-th`)  
✅ Vercel project initialized (`.vercel` directory exists)  
✅ Vercel CLI will be auto-installed if missing  

## Parallel Deployments

You now have both:
- **Cloudflare Pages** (Original) - `https://financeplan-th.pages.dev`
- **Vercel** (New) - Check Vercel dashboard for URL

Both can coexist and receive updates independently.

## Error Handling

If any step fails:
1. Error message displays with context
2. Script pauses to show error details
3. Press any key to dismiss and retry
4. Fix the issue and run script again

## Version History

- **V3.0.0** - Single platform (Cloudflare only)
- **V4.0.0** - Multi-platform with interactive menu ← **You are here**

---

**Created:** April 22, 2026  
**Status:** Ready for production use
