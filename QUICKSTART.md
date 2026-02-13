# Quick Start Guide

Get Job Search Copilot running in 5 minutes.

## 1. Prerequisites (2 min)

- Install Node.js 18+: https://nodejs.org/
- Create Supabase account: https://supabase.com (free tier)

## 2. Clone & Setup (1 min)

```bash
git clone https://github.com/Sandhyasrinivas0221/job-search-copilot.git
cd job-search-copilot
npm install
```

## 3. Configure (1 min)

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Get your keys:
1. Create project in Supabase dashboard
2. Go to Settings → API
3. Copy the values

## 4. Database Setup (30 sec)

1. In Supabase, go to SQL Editor
2. Click "New Query"
3. Paste contents of `supabase/migrations/001_init.sql`
4. Click Run

## 5. Start & Test (1 min)

```bash
npm run dev
```

Visit: http://localhost:3000

You should see the dashboard home page!

## Next: Try the Agents

### Test with sample data:

```bash
# Test Mail Agent
curl -X POST http://localhost:3000/api/agents/mail \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user",
    "emails": [{
      "from": "recruiter@company.com",
      "subject": "Interview Scheduled",
      "body": "We would like to schedule an interview.",
      "timestamp": "2026-02-13T10:00:00Z"
    }]
  }'

# Test Metrics
curl http://localhost:3000/api/metrics?userId=demo-user
```

## Troubleshooting

**`401 Unauthorized`** from API?
→ Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

**Database tables not found?**
→ Re-run the SQL migration in Supabase SQL Editor

**Blank dashboard?**
→ Create a test user first:
```sql
INSERT INTO users (id, email, full_name, skills)
VALUES ('demo-user', 'demo@example.com', 'Demo User', ARRAY['JavaScript', 'React']);
```

## What's Next?

- Read `SETUP.md` for detailed configuration
- Read `ARCHITECTURE.md` for system design
- Check `README.md` for full feature list
- Explore source in `src/agents/` to customize

## Key Files

| File | Purpose |
|------|---------|
| `src/agents/` | 6 intelligent agents |
| `src/app/api/` | API endpoints |
| `src/app/dashboard/` | UI pages |
| `src/lib/db.ts` | Database operations |
| `src/types/index.ts` | TypeScript types |
| `.env.local.example` | Environment template |

## Quick Links

-📖 [Full Setup Guide](./SETUP.md)
- 🏗️ [Architecture](./ARCHITECTURE.md)
- 📚 [Feature Guide](./README.md)
- 🔌 [API Reference](./README.md#-api-reference)

---

**Stuck?** Check troubleshooting in `SETUP.md` or open an issue on GitHub!
