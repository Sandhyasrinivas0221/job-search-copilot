# 🚀 FREE TIER PRODUCTION SETUP (10-15 Users)

**Date**: 2026-03-26
**Target**: Deploy with 100% FREE APIs only
**Users**: 10-15 (upgrade to paid later)

---

## 💰 FREE TIER API LIMITS

| Service | Free Tier | Limit | Cost Overages |
|---------|-----------|-------|---------------|
| **Supabase DB** | ✅ FREE | 500MB storage, 5GB/month bandwidth | $10/mo per GB extra |
| **Gmail API** | ✅ FREE | Unlimited labels reads (OAuth) | $0 (no charge) |
| **Google OAuth** | ✅ FREE | Unlimited logins | $0 (no charge) |
| **Resend Email** | ✅ FREE | 100 emails/day | $0.0005 per email after 100 |
| **Vercel Hosting** | ✅ FREE | 100GB bandwidth/month | $0.50 per extra GB |

**TOTAL COST: $0/month** for 10-15 users ✅

---

## ❌ TEST DATA TO REMOVE

### Hardcoded Test UUIDs in Dashboards (5 files)
- src/app/dashboard/applications/page.tsx (line 29)
- src/app/dashboard/learning/page.tsx  
- src/app/dashboard/metrics/page.tsx
- src/app/dashboard/pipeline/page.tsx
- src/app/dashboard/suggestions/page.tsx

**Issue**: Falls back to `00000000-0000-0000-0000-000000000001`
**Fix**: Redirect to login if user not authenticated

### OAuth Test Fallback
- src/app/api/auth/google/callback/route.ts (lines 43-50)

**Issue**: Accepts requests without state parameter (test mode)
**Fix**: Require state parameter always

---

## ✅ REQUIRED: Gmail OAuth Setup

```bash
# 1. Create Google Cloud Project
https://console.cloud.google.com/projectcreate
# Name: "Job Search Copilot"

# 2. Enable Gmail API
https://console.cloud.google.com/apis/library/gmail.googleapis.com
# Click "ENABLE"

# 3. Create OAuth 2.0 Credentials
https://console.cloud.google.com/apis/credentials
# OAuth 2.0 Client IDs → Web application
#  Authorized redirect: https://yourdomain.com/api/auth/google/callback

# 4. Save Keys
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

**FREE**: Unlimited email reads via Gmail API

---

## ✅ REQUIRED: Email (Resend - FREE)

```bash
# 1. Sign up: https://resend.com
# 2. Create API key: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxx
```

**FREE**: 100 emails/day (perfect for 10-15 users)

---

## 🔄 PRODUCTION USER FLOW

1. **User Signs Up**
   - Email verification
   - No test data created

2. **User Connects Gmail**
   - Settings → "Connect Gmail"
   - OAuth authorization
   - Refresh token saved

3. **Agents Process Emails** (Automatically)
   - Mail Listener: Reads Gmail every 5 min
   - Tracker: Updates statuses every 10 min
   - Skill Research: Extracts skills every 6 hours
   - Learning Planner: Creates tasks at 8 AM
   - System Observer: Sends email at 9 AM

4. **Result**: All data is real, no test records

---

## 📋 API KEYS (4 Total - All FREE)

| Key | Service | Free? | Status |
|-----|---------|-------|--------|
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | Google | ✅ | ⏳ User action |
| GOOGLE_CLIENT_SECRET | Google | ✅ | ⏳ User action |
| RESEND_API_KEY | Resend | ✅ | ⏳ User action |
| CRON_SECRET | Custom | ✅ | ✅ Ready |

**All 4 keys = $0 total cost** ✅

---

See FREE_TIER_MASTER_CHECKLIST.md for complete deployment steps!
