# Job Search Copilot - Setup Guide

Complete step-by-step instructions to set up the Job Search Copilot on your local machine or production server.

## Prerequisites

- **Node.js**: 18.17 or later (https://nodejs.org/)
- **npm**: 9 or later
- **Supabase Account**: Free tier available at https://supabase.com
- **Git**: For version control (https://git-scm.com/)

Optional:
- **Resend Account** (https://resend.com) - for email delivery
- **Gmail/Outlook** - for email polling integration

## Step 1: Clone the Repository

```bash
git clone https://github.com/Sandhyasrinivas0221/job-search-copilot.git
cd job-search-copilot
```

## Step 2: Install Dependencies

```bash
npm install
```

The project uses these key dependencies:
- `next`: 14.2.0 - React framework
- `@supabase/supabase-js`: Database client
- `tailwindcss`: Styling
- `node-cron`: Agent scheduling
- `zod`: Data validation

## Step 3: Set Up Supabase

### Create Supabase Project

1. Go to https://supabase.com and sign up
2. Click "New Project"
3. Fill in details:
   - Project name: `job-search-copilot`
   - Database password: (generate strong password)
   - Region: Choose closest to you
4. Wait for project to initialize (~2 minutes)

### Get API Keys

1. Go to Project Settings → API
2. Copy and save:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Run Database Migrations

1. Go to SQL Editor in Supabase dashboard
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_init.sql`
4. Paste into the SQL editor
5. Click "Run"
6. Verify tables are created in the "Tables" section

### Verify Schema

Check that all tables exist:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

Should show: `users`, `applications`, `status_history`, `job_suggestions`, `skill_demand`, `learning_tasks`

## Step 4: Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

### Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Optional: Email Delivery (Resend)

```env
RESEND_API_KEY=re_xxx
SYSTEM_EMAIL_FROM=noreply@jobsearchcopilot.com
SYSTEM_EMAIL_TO=your-email@example.com
```

Get Resend API key:
1. Go to https://resend.com
2. Sign up and verify email
3. Create API token in dashboard
4. Paste into `.env.local`

### Optional: Email Polling

For Gmail:
```env
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

Generate Gmail app password:
1. Enable 2FA on your Google account
2. Go to myaccount.google.com → Security
3. Find "App passwords" section
4. Select Mail and Windows Computer
5. Copy the 16-character password
6. Click "Create"

For Outlook:
```env
OUTLOOK_EMAIL=your-email@outlook.com
OUTLOOK_PASSWORD=your-password
```

## Step 5: Run Development Server

```bash
npm run dev
```

Open browser to `http://localhost:3000`

You should see the Job Search Copilot home page.

## Step 6: Create a Test User

Since there's no authentication system yet, create a test user:

1. Go to http://localhost:3000/api/applications?userId=demo-user
2. This confirms the API is working

Or create via Supabase:

1. Go to Supabase dashboard → SQL Editor
2. Run:
```sql
INSERT INTO users (id, email, full_name, skills)
VALUES (
  'demo-user',
  'demo@example.com',
  'Demo User',
  ARRAY['JavaScript', 'React', 'Node.js', 'PostgreSQL']
);
```

## Step 7: Test the Agents

### Test Mail Agent

```bash
curl -X POST http://localhost:3000/api/agents/mail \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user",
    "emails": [{
      "from": "recruiter@techcorp.com",
      "subject": "Interview Scheduled - Senior Developer",
      "body": "We would like to schedule an interview for next week.",
      "timestamp": "2026-02-13T10:00:00Z"
    }]
  }'
```

### Test Tracker Agent

```bash
curl -X POST http://localhost:3000/api/agents/tracker \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user"}'
```

### Test Metrics

```bash
curl http://localhost:3000/api/metrics?userId=demo-user
```

## Step 8: Set Up Agent Scheduling (Optional)

### For Development (using node-cron)

1. Update `src/lib/scheduler.ts` with your userId
2. Import and call in your main server file:

```typescript
// src/app/layout.tsx or server.ts
import { scheduleAgents } from '@/lib/scheduler'

// Call once on app start
if (process.env.NODE_ENV === 'production') {
  scheduleAgents('demo-user')
}
```

### For Production (Vercel)

1. Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/mail-agent",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/tracker-agent",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

2. Create cron endpoints:
```typescript
// src/app/api/cron/mail-agent/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Run agent...
  return NextResponse.json({ success: true })
}
```

3. Add `CRON_SECRET` to Vercel environment variables

## Step 9: Verify Installation

Check that everything is working:

1. **Home Page**
   - http://localhost:3000
   - Should display dashboard overview

2. **Pipeline Board**
   - http://localhost:3000/dashboard/pipeline
   - Should show empty columns (no applications yet)

3. **Metrics**
   - http://localhost:3000/dashboard/metrics
   - Should show 0 applications

4. **API Health**
   ```bash
   curl http://localhost:3000/api/metrics?userId=demo-user
   ```

## Troubleshooting

### Connection Error to Supabase

**Error**: `Error: Invalid Supabase URL`

**Solution**:
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify format: `https://xxx.supabase.co`
- Restart dev server: `npm run dev`

### Database Schema Error

**Error**: `Error: relation "applications" does not exist`

**Solution**:
- Verify migrations ran: Check Supabase Tables tab
- Re-run migration SQL in Supabase SQL Editor
- Check service role key permissions

### Email Not Sending

**Error**: `Error: Resend API error`

**Solution**:
- Verify `RESEND_API_KEY` is correct
- Check email format is valid
- Verify sender domain in Resend dashboard

### Agents Not Running

**Error**: `Agents not running at scheduled times`

**Solution**:
- In dev: Check if scheduler is initialized in `layout.tsx`
- In production: Check Vercel logs
- Validate cron expressions on https://crontab.guru/

## Next Steps

1. **Add Authentication** (optional)
   - Integrate Supabase Auth
   - Implement login/signup flow

2. **Email Integration** (optional)
   - Set up Gmail/Outlook polling
   - Test with real emails

3. **Deployment**
   - Deploy to Vercel: `vercel deploy`
   - Or deploy to own server

4. **Customization**
   - Modify email detection patterns
   - Add more job sources
   - Customize learning resources

## Need Help?

- **Documentation**: See `README.md`
- **GitHub Issues**: https://github.com/Sandhyasrinivas0221/job-search-copilot/issues
- **Supabase Docs**: https://supabase.com/docs

## Quick Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Agents | `src/agents/` | Core business logic |
| API Routes | `src/app/api/` | HTTP endpoints |
| Types | `src/types/index.ts` | TypeScript definitions |
| Database | `src/lib/db.ts` | CRUD operations |
| Database Schema | `supabase/migrations/001_init.sql` | SQL schema |
| UI Pages | `src/app/dashboard/` | React components |
| Configuration | `.env.local` | Environment variables |

---

Enjoy building your job search system! 🚀
