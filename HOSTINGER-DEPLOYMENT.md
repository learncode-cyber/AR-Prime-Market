# 🚀 HOSTINGER AUTO-DEPLOYMENT GUIDE

**Complete guide for deploying AR Prime Market to Hostinger with auto-deployment via GitHub**

---

## ⚡ QUICK DEPLOYMENT (15 MINUTES TO LIVE)

### Step 1: Prepare Your Code (Locally)

```bash
# Extract project
unzip ar-prime-market-COMPLETE-WITH-CATEGORY-FIXES.zip
cd ar-prime-market-MEGA/ar-prime-base

# Install dependencies
npm install

# Build locally to verify
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 2: Create GitHub Repository

Go to https://github.com/new

```
Repository name: ar-prime-market
Visibility: PUBLIC (IMPORTANT!)
Add .gitignore: Node
Initialize with README: No (we have one)
```

Click **Create repository**

### Step 3: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit: AR Prime Market ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ar-prime-market.git
git push -u origin main
```

### Step 4: Setup Hostinger

#### Go to hPanel (Your Hostinger Control Panel)

1. **Click Node.js Web App**
2. **Click Create Application**

#### Fill Application Settings:

```
📝 Application Name:     ar-prime-market
📝 Node.js Version:      18 LTS
📝 Package Manager:      npm
📝 Public Directory:     dist/
📝 Start Command:        node dist/server.js
📝 Build Command:        npm run build
```

#### Connect GitHub:

1. Click **Repository**
2. Select **Connect with GitHub**
3. Authorize Hostinger to access your GitHub
4. Select your repository: `ar-prime-market`
5. Select branch: `main`
6. Click **Confirm**

#### Add Environment Variables:

1. Go to **Variables** in app settings
2. Click **Add Variable**
3. Add each variable from `.env.example`:

```
SUPABASE_URL              → your-project.supabase.co
SUPABASE_ANON_KEY         → Your anon key
SUPABASE_SERVICE_ROLE_KEY → Your service role key
CJ_API_KEY                → Your CJ API key
STRIPE_API_KEY            → Your Stripe key
GOOGLE_ANALYTICS_ID       → Your GA ID
[Add all others from .env.example]
```

**IMPORTANT:** Do NOT include `VITE_` prefix for private keys!

### Step 5: First Deployment

Hostinger will now automatically:

```
1. Clone your GitHub repository
2. Run: npm install
3. Run: npm run build
4. Start: node dist/server.js
5. Your app goes LIVE! 🎉
```

**Status:** Watch the deployment log in hPanel

**Time:** 2-5 minutes

### Step 6: Verify Deployment

```
1. Check Hostinger deployment status (should show ✅ Active)
2. Visit your domain
3. Homepage should load
4. Test category clicks
5. Test admin panel (/admin/products)
```

**Your site is LIVE!** 🎉

---

## 🔄 FUTURE DEPLOYMENTS (AUTOMATIC!)

### Making Changes

Now, whenever you push code to GitHub, Hostinger automatically deploys:

```bash
# Make changes locally
nano src/components/Product.tsx

# Test locally
npm run dev

# Commit and push
git add .
git commit -m "Feature: Update product display"
git push origin main

# Wait 2-5 minutes → Changes are LIVE! 🚀
```

No more manual deployment needed!

---

## 🏗️ BUILD PROCESS EXPLAINED

When you push to GitHub, Hostinger runs:

### 1. Clone Repository
```bash
git clone https://github.com/YOU/ar-prime-market.git
cd ar-prime-market
```

### 2. Install Dependencies
```bash
npm install
# Downloads all packages from package.json
```

### 3. Run Migrations (if configured)
```bash
npx supabase migration up
# Creates/updates database tables
```

### 4. Build for Production
```bash
npm run build
# Creates optimized dist/ folder
# Compiles TypeScript
# Bundles React
# Minifies CSS/JS
```

### 5. Start Application
```bash
node dist/server.js
# Starts Node.js server on port 3000
# Hostinger proxies requests to it
```

**Result:** Your site goes live at your Hostinger domain! 🎉

---

## 📊 DEPLOYMENT STATUS

In hPanel, you'll see:

```
🔵 Deploying...        (Currently deploying)
🟢 Active ✅           (Live and running)
🔴 Failed              (Check logs)
```

Click app name → View Logs to see deployment details

---

## 🆘 TROUBLESHOOTING

### Issue: Build fails

**Solution:**
```bash
# Check locally first
npm install
npm run build

# If fails locally, fix it before pushing to GitHub
# If works locally but fails on Hostinger:
# - Check environment variables
# - Check Node version matches (18 LTS)
# - Check for missing dependencies
```

### Issue: App deploys but doesn't start

**Check:**
1. Start Command is correct: `node dist/server.js`
2. dist/ folder was created
3. Environment variables are set
4. Check Hostinger logs for errors

### Issue: Changes aren't showing after push

**Solutions:**
1. Wait 2-5 minutes for deployment
2. Hard refresh browser (Ctrl+F5)
3. Clear browser cache
4. Check deployment status in hPanel
5. Check GitHub Actions logs

### Issue: Database connection failing

**Check:**
1. SUPABASE_URL is set correctly
2. SUPABASE_ANON_KEY is set correctly
3. Database is accessible from Hostinger IP
4. Migrations have run successfully

---

## 🔐 SECURITY CHECKLIST

```
✅ GitHub repository is PUBLIC
✅ Sensitive keys in .env (not in code)
✅ .gitignore excludes .env files
✅ SSH key configured in Hostinger
✅ Only main branch deploys
✅ All npm packages are verified
✅ No credentials in package.json
✅ CORS configured for your domain
```

---

## 📈 PERFORMANCE TIPS

1. **Minimize bundle size**
   - Tree-shake unused code
   - Use dynamic imports
   - Lazy load components

2. **Optimize images**
   - Compress before uploading
   - Use WebP format
   - Serve appropriate sizes

3. **Cache strategy**
   - Set cache headers
   - Use CDN if available
   - Cache API responses

4. **Monitor performance**
   - Check Hostinger metrics
   - Monitor Google Analytics
   - Track Core Web Vitals

---

## 🚀 DEPLOYMENT SCRIPT

For reference, here's what Hostinger runs:

```bash
#!/bin/bash
set -e

# 1. Clone repository
git clone $GITHUB_REPO $APP_PATH
cd $APP_PATH

# 2. Install dependencies
npm ci  # Cleaner than npm install for CI

# 3. Build application
npm run build

# 4. Start application
node dist/server.js
```

This is automated in Hostinger!

---

## 📝 DEPLOYMENT WORKFLOW

```
Local Development
    ↓ git push origin main
GitHub Repository
    ↓ GitHub detects push
GitHub Actions (if configured)
    ↓ Webhook trigger
Hostinger
    ↓ Auto-deployment starts
    ├─ Clone repo
    ├─ npm install
    ├─ npm run build
    └─ node dist/server.js
LIVE WEBSITE! 🎉
```

---

## ✅ VERIFICATION

After deployment, verify:

```
✅ Homepage loads
✅ All routes work
✅ API endpoints respond
✅ Database queries work
✅ Authentication works
✅ Category clicks work
✅ Admin panel accessible
✅ No console errors
✅ Performance is good
✅ Mobile view works
```

---

## 🎯 FINAL CHECKLIST

Before going to production:

```
Code:
☑ npm run build succeeds
☑ npm run type-check passes
☑ npm run lint passes
☑ No console errors locally

GitHub:
☑ Repository created
☑ Code pushed to main branch
☑ .env.example updated
☑ README.md complete

Hostinger:
☑ App created
☑ GitHub connected
☑ Environment variables added
☑ Start command correct
☑ Build command correct

Verification:
☑ First deployment successful
☑ Site accessible
☑ Features working
☑ No errors in logs

Ready to Scale:
☑ Monitor performance
☑ Setup monitoring
☑ Configure backups
☑ Setup SSL certificate
```

---

## 🎉 YOU'RE LIVE!

```
✅ Deployed to Hostinger
✅ Auto-deployment configured
✅ Site is live
✅ Changes auto-deploy
✅ Revenue ready

Next: Start promoting! 💰
```

---

**Questions?**
- Check Hostinger documentation
- Review GitHub Actions logs
- Check application logs in hPanel

**Happy deploying! 🚀**

