# ✅ FREE TIER PRODUCTION - MASTER CHECKLIST

**Status**: Ready for production
**Cost**: $0/month  
**Users**: 10-15
**Timeline**: 2-4 hours

---

## PHASE 1: REMOVE TEST DATA (20 min)

- [ ] **See**: REMOVE_TEST_DATA.md for all code changes
- [ ] **Action**: Fix 6 dashboard files + 1 OAuth file
- [ ] **Verify**:
  ```bash
  grep -r "00000000-0000-0000-0000-000000000001" src/
  # Should return 0 results
  ```

---

## PHASE 2: GET API KEYS (45 min)

### Google OAuth (Gmail Integration)

- [ ] Go: https://console.cloud.google.com/projectcreate
- [ ] Name: "Job Search Copilot" → Create
- [ ] Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
- [ ] Create OAuth credentials: https://console.cloud.google.com/apis/credentials
  - Application type: Web application
  - Redirect URI: `https://yourdomain.com/api/auth/google/callback`
- [ ] Save: **Client ID** & **Client Secret**

### Resend Email

- [ ] Go: https://resend.com
- [ ] Sign up (free, no credit card)
- [ ] API Keys: https://resend.com/api-keys
- [ ] Create API Key
- [ ] Save: **API Key**

### Cron Security

- [ ] Generate random string:
  ```bash
  openssl rand -hex 16
  ```
- [ ] Save: **CRON_SECRET**

---

## PHASE 3: DEPLOY TO VERCEL (15 min)

### Add Environment Variables

- [ ] Vercel Dashboard → Settings → Environment Variables
- [ ] Add 4 keys:
  ```
  NEXT_PUBLIC_GOOGLE_CLIENT_ID = your-client-id
  GOOGLE_CLIENT_SECRET = your-client-secret
  GOOGLE_OAUTH_REDIRECT_URI = https://yourdomain.com/api/auth/google/callback
  RESEND_API_KEY = re_xxxxx
  CRON_SECRET = xxxxx (random)
  ```

### Commit & Push

- [ ] Fix test data (Phase 1)
- [ ] ```bash
  git add -A
  git commit -m "Production: Remove test data, enable free tier (Gmail + Resend)"
  git push origin main
  ```
- [ ] Vercel auto-deploys from main ✅

---

## PHASE 4: TEST COMPLETE FLOW (1 hour)

### Setup Test User

- [ ] Sign up: test-user@yourmail.com
- [ ] Verify email

- [ ] Connect Gmail:
  - Settings → Email Configuration
  - Click "Connect Gmail"
  - Authorize
  - Shows "Gmail Connected ✓"

### Trigger Agents

- [ ] Forward job email to your Gmail:
  ```
  Subject: "Interview Scheduled - Senior Backend Engineer at Google  
  Body: "We're excited to schedule your interview..."
  ```

- [ ] Wait 5 minutes (Mail Listener runs every 5 min)
- [ ] Check dashboard:
  - Applications tab
  - Should show: "Google - Senior Backend Engineer"
  - Status: "INTERVIEW"
  - ✅ Real data, no test UUID

### Verify Agent Chain

- [ ] Learning tasks created:
  - Dashboard → Learning
  - Should show: "System Design", "Go", etc.
  - All resources: FREE (freeCodeCamp, GitHub, etc.)

- [ ] Daily email received:
  - Wait until 9 AM tomorrow
  - Check inbox
  - Email shows: metrics + tasks
  - Status: Sent via Resend ✅

---

## PHASE 5: SCALE TO 10-15 USERS (Optional)

- [ ] Add more test users
- [ ] Each connects own Gmail
- [ ] Verify:
  - Each user sees own data only
  - Emails delivered (Resend: <100/day)
  - No errors in logs

---

## 🎯 FINAL VERIFICATION

```bash
# No test data
grep -r "00000000-0000-0000" src/ → 0 results ✓

# All keys configured
echo $RESEND_API_KEY → re_... ✓

# Agents running
Vercel Logs: Mail Listener, Tracker, Learning, Observer → Success ✓

# Cost tracking
Database: SELECT SUM(total_cost) FROM cost_tracking → 0 ✓
```

---

## 💰 COSTS: $0/Month

- Supabase: FREE (500MB)
- Gmail API: FREE (unlimited)  
- Resend: FREE (100 emails/day)
- Vercel: FREE (100GB bandwidth)

**For 10-15 users**: All within free limits ✅

---

## 🚀 PRODUCTION FLOW

```
User Signup
    ↓
Connect Gmail (OAuth)
    ↓
Forward job email
    ↓
Mail Listener reads→ Creates Application
    ↓
Tracker Agent → Updates status
    ↓
Skill Research → Extracts skills
    ↓
Learning Planner → Creates tasks
    ↓
System Observer → Sends daily email (Resend)
    ↓
User feels successful!
```

**All FREE, all automatic, no test data** ✅

---

## ⏱️ TIMELINE

- Remove test: 20 min
- Get API keys: 45 min
- Deploy: 15 min
- Test: 1 hour
- **Total: ~2 hours**

Ready?
