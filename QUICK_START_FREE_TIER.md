# 🚀 QUICK START: Free Tier Production Deployment

**Total time**: 2-3 hours → Live with real users

---

## ⏰ STEP 1: Remove Test Data (20 min)

See exact changes in: `REMOVE_TEST_DATA.md`

Quick summary:
- 5 dashboard files: Replace test UUID fallback with login redirect
- 1 OAuth file: Always require state parameter
- 3 cron files: Remove "Skip auth in development" comment

```bash
# Verify clean
grep -r "00000000-0000-0000" src/
# Should return: 0 results
```

---

## 🔑 STEP 2: Get 4 API Keys (45 min)

### Google OAuth (Gmail Integration)
1. https://console.cloud.google.com/projectcreate
   - Name: `Job Search Copilot`
   - Create

2. Enable Gmail API:
   https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - Click ENABLE

3. Create OAuth credentials:
   https://console.cloud.google.com/apis/credentials
   - OAuth 2.0 Client IDs → Web application
   - Redirect URI: `https://yourdomain.com/api/auth/google/callback`
   - Create
   - **Save**: Client ID + Client Secret

### Resend (Email - FREE)
1. https://resend.com
   - Sign up (no credit card)
   - Verify email

2. https://resend.com/api-keys
   - Create API Key
   - **Save**: API Key

### Cron Secret
```bash
openssl rand -hex 16
# Copy output: XXXXXXXXXXXX
```

---

## ✅ STEP 3: Deploy to Vercel (15 min)

### Add Environment Variables

Vercel Dashboard → Project → Settings → Environment Variables

Add 4 keys:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID = [your-client-id]
GOOGLE_CLIENT_SECRET = [your-client-secret]
GOOGLE_OAUTH_REDIRECT_URI = https://yourdomain.com/api/auth/google/callback
RESEND_API_KEY = re_[your-key]
CRON_SECRET = [random-32-char-string]
```

### Push Code

```bash
cd /path/to/project

# Apply changes from REMOVE_TEST_DATA.md
# (5 dashboard files + 1 OAuth file)

git add -A
git commit -m "Production: Remove test data, enable free tier"
git push origin main

# Vercel auto-deploys ✅
```

---

## 🧪 STEP 4: Test Complete Flow (1 hour)

### Create Test User
1. Go: https://yourdomain.com
2. Sign up: `test@gmail.com` (use real Gmail)
3. Verify email

### Connect Gmail
1. Dashboard → Settings → Email Configuration
2. Click "Connect Gmail"
3. Authorize OAuth
4. Shows "Gmail Connected ✓"

### Trigger Agents
1. Send yourself email:
   ```
   To: your@gmail.com
   Subject: Interview Scheduled - Senior Backend at Google
   Body: We're excited to invite you to interview...
   ```

2. Wait 5-10 minutes for Mail Listener to run

3. Check dashboard:
   - Applications tab
   - Should show: "Google - Senior Backend"
   - Status: INTERVIEW
   - ✅ Real data (no test UUID)

### Verify Learning Tasks
1. Learning tab
2. Should show: "System Design", "Go", etc.
3. All resources: FREE ✅

### Daily Email (Tomorrow)
1. Check inbox at 9 AM
2. Should receive email with:
   - Dashboard metrics
   - Learning tasks
   - Application summary
3. Sent via Resend ✅

---

## ✨ RESULT: Live in Production

- ✅ User signs up
- ✅ Connects Gmail
- ✅ Forwards job emails
- ✅ All agents process automatically
- ✅ Daily summaries sent
- ✅ All data is real (no test records)
- ✅ Cost: $0/month

---

## 📚 Need More Details?

- **Deployment**: See `FREE_TIER_MASTER_CHECKLIST.md`
- **Code Changes**: See `REMOVE_TEST_DATA.md`
- **Overview**: See `FREE_TIER_PRODUCTION_SETUP.md`
- **Setup Guide**: See `SETUP.md`

---

## 🎯 Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Remove test data | 20 min |
| 2 | Get API keys | 45 min |
| 3 | Deploy to Vercel | 15 min |
| 4 | Test with real user | 1 hour |
| | TOTAL | ~2 hours |

---

Ready? Start with Step 1! 🚀
