# Supabase Magic Link Setup Checklist

**Estimated time: 5 minutes**

This checklist will configure Supabase for magic-link authentication on the Financial 101 app.

## 1. Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"** (free tier is fine)
3. Select your organization, project name, and password
4. Wait for the project to initialize (1–2 minutes)

## 2. Get Your API Credentials

1. Go to **Project Settings** → **API**
2. Copy the **Project URL** (e.g., `https://xxx.supabase.co`)
3. Copy the **`anon` public key** (starts with `eyJhbGci...`)
4. Save both — you'll paste them into Vercel in a moment

## 3. Configure Email Authentication

1. Go to **Authentication** → **Providers**
2. Find **Email** and click to enable it
3. Confirm these settings:
   - ✓ **Confirm email** is ON
   - ✓ **Enable Email Signups** is ON
4. Click **Save**

## 4. Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**:
   ```
   https://financial101.vercel.app
   ```
3. Under **Redirect URLs**, add both (one per line):
   ```
   https://financial101.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
4. Click **Save**

## 5. (Optional) Customize Email Template

1. Go to **Authentication** → **Email Templates**
2. Click **Magic Link**
3. Customize the subject and body if desired (or leave as-is)
4. Click **Save**

## 6. Add Supabase Credentials to Vercel

1. Go to https://vercel.com
2. Open the **financial101** project
3. Go to **Settings** → **Environment Variables**
4. Add three new variables:
   - **Key:** `NEXT_PUBLIC_SUPABASE_URL`  
     **Value:** (paste the Project URL from step 2)
   - **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
     **Value:** (paste the anon key from step 2)
   - **Key:** `NEXT_PUBLIC_ALLOWED_EMAILS`  
     **Value:** `toy.theeranan@gmail.com,toy.theeranan@icloud.com`
5. Click **Save** for each

## 7. Redeploy

1. Go back to the **Deployments** tab
2. Click **Redeploy** on the latest production deployment
3. Wait for the build and deploy to finish (~2 minutes)

## 8. Test the Flow

1. Visit https://financial101.vercel.app/login
2. Enter `toy.theeranan@gmail.com`
3. Check the inbox for a magic sign-in link (may be in spam)
4. Click the link — you should land on `/` authenticated with all financial data visible
5. Verify the app is fully functional (navigate to /accounts, /profile, etc.)

## Troubleshooting

- **Magic link doesn't arrive?**
  - Check spam/promotions folder
  - Verify the email address is exactly as configured
  - Check Supabase **Authentication** → **Users** to see if a user was created

- **"Access denied"?**
  - The email is not on the `NEXT_PUBLIC_ALLOWED_EMAILS` list
  - Add it in Vercel → Settings → Environment Variables

- **Build fails after adding these changes?**
  - Run `npm run build` locally to check for TypeScript errors
  - Ensure all `.ts` files are syntactically valid

- **Can't click the magic link?**
  - Confirm the Redirect URLs include both prod and `http://localhost:3000/auth/callback`
  - Check the URL in the email; it should end with `/auth/callback?code=...`

---

Once testing passes, you're done! The old username/password login is now disabled, and all users authenticate via magic link.
