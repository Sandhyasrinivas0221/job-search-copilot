# Job Search Copilot 🚀

**Ship Faster-Powered Multi-Agent Job Search System**

A production-ready, intelligent job search automation platform built with Next.js 14, TypeScript, Supabase, and inspired by **Ship Faster** patterns. This system runs 6 autonomous agents that work independently to automate job application tracking, market analysis, skill development planning, and daily email reports.

## ✨ What's New (Ship Faster Integration)

✅ **Skills-Based Architecture** - Each agent is a reusable "skill" with metadata (`skill.json`) and sealed boundaries
✅ **Scheduled Job Automation** - Vercel Cron jobs + node-cron for reliable agent execution
✅ **RLS Policies** - Row-Level Security on all tables for data isolation
✅ **Approval Gates** - Status changes can require approval before confirmation
✅ **Agent Audit Logs** - Complete audit trail of all agent actions
✅ **Email System** - Built-in support for Resend + SMTP with daily 9 AM summaries
✅ **Escalation Framework** - Agents can escalate ambiguous situations to human review

---

## 🤖 The 6 Agents (Ship Faster Skills)

### 1. **Workflow: Mail Listener** (`skills/workflow-mail-listener/`)
Monitors email inboxes and detects job application status changes.

**Sealed Abilities**:
- ✅ Can: Read emails, create/update Applications, create StatusHistory
- ❌ Cannot: Send emails, apply to jobs

**Event Detection**:
- Application received
- Interview scheduled
- Technical assessment (OA) sent
- Rejection
- Job offer
- Interview feedback

**Escalation**:
- Ambiguous emails → `NEEDS_REVIEW` status
- Cannot extract company → Log for manual review

**Schedule**: Every 5 minutes (`*/5 * * * *`)

### 2. **Workflow: Tracker** (`skills/workflow-tracker/`)
Manages application pipeline with automatic status derivation and escalation.

**Sealed Abilities**:
- ✅ Can: Read/update Applications, create StatusHistory
- ❌ Cannot: Read raw emails, create new applications

**Automation Rules**:
- `APPLIED → FOLLOW_UP_SUGGESTED` (after 7 days)
- `APPLIED → NO_RESPONSE` (after 14 days with no update)
- `REJECTED` (within 3 days) → `ARCHIVED` (early rejection)
- Updates `daysInStage` field daily

**Schedule**: Every 10 minutes (`*/10 * * * *`)

### 3. **Workflow: Role Finder** (`skills/workflow-role-finder/`)
Searches job boards and creates intelligent job suggestions.

**Sealed Abilities**:
- ✅ Can: Search jobs, create JobSuggestions, calculate match scores
- ❌ Cannot: Submit applications, modify Applications

**Features**:
- Multi-source job aggregation (Indeed, LinkedIn, GitHub)
- Skill-based match scoring (0-100)
- Easy Apply detection
- Duplicate prevention

**Escalation**:
- High rejection rate → Widen search criteria
- Increasing offers → Prioritize similar roles

**Schedule**: Hourly (`0 * * * *`)

### 4. **Workflow: Market Scanner** (`skills/workflow-market-scanner/`)
Analyzes job market to identify trending skills and skill gaps.

**Sealed Abilities**:
- ✅ Can: Analyze job descriptions, create/update SkillDemand
- ❌ Cannot: Modify Applications, modify JobSuggestions

**Intelligence**:
- Extracts 40+ distinct skills
- Clusters into 10 themes (Java Core, Spring, Cloud, etc.)
- Detects rising trends (offer/rejection ratio)
- Tracks frequency metrics

**Escalation**:
- Trending skill user lacks → Alert Learning Planner

**Schedule**: Daily at 11:00 AM (`0 11 * * *`)

### 5. **Workflow: Gap Closer** (`skills/workflow-gap-closer/`)
Generates personalized learning plans based on market demand and rejection patterns.

**Sealed Abilities**:
- ✅ Can: Create LearningTasks, read SkillDemand & rejection history
- ❌ Cannot: Apply to jobs, change application statuses

**Features**:
- Weekly learning plan generation
- Interview prep packs for challenging roles
- Resource curation by topic
- Difficulty progression

**Escalation**:
- Repeated rejections at same stage → Increase focus
- User progressing well → Increase difficulty

**Schedule**: Daily at 8:00 AM (`0 8 * * *`)

### 6. **Workflow: Metrics Reporter** (`skills/workflow-metrics-reporter/`)
Computes dashboard metrics and sends daily job recommendations via email.

**Sealed Abilities**:
- ✅ Can: Read all tables, compute metrics, send emails
- ❌ Cannot: Modify any data

**Daily Email (9:00 AM)**:
- Dashboard metrics (interview %, offer %, rejection %)
- New job suggestions ranked by match score
- Easy Apply opportunities highlighted
- Learning task reminders

**Escalation**:
- Zero interview rate with 5+ apps → Alert Job Market + Learning Planner

**Schedule**: Daily at 9:00 AM (`0 9 * * *`)

---

## 🏗️ Project Structure

```
job-search-copilot/
├── skills/                    ← Ship Faster-style agent definitions
│   ├── workflow-mail-listener/
│   │   ├── skill.json         (metadata + sealed abilities)
│   │   └── index.ts           (implementation)
│   ├── workflow-tracker/
│   ├── workflow-role-finder/
│   ├── workflow-market-scanner/
│   ├── workflow-gap-closer/
│   └── workflow-metrics-reporter/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/          (Agent trigger endpoints)
│   │   │   ├── cron/            (Vercel Cron routes)
│   │   │   └── ...
│   │   ├── dashboard/           (UI components)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── lib/
│   │   ├── supabase.ts          (Supabase client)
│   │   ├── db.ts                (CRUD operations)
│   │   ├── agent-logger.ts      (Audit logging)
│   │   ├── scheduled-jobs.ts    (Cron config)
│   │   ├── email-system.ts      (Email utilities)
│   │   └── ...
│   │
│   └── types/
│       └── index.ts             (130+ TypeScript interfaces)
│
├── supabase/
│   └── migrations/
│       ├── 001_init.sql         (Initial schema)
│       └── 002_add_rls_and_approval_gates.sql
│
├── vercel.json                  (Cron job definitions)
└── .env.local.example           (Configuration template)
```

---

## 📊 Database Schema

### Core Tables (with RLS Policies)

| Table | Purpose | RLS Policy |
|-------|---------|-----------|
| `users` | User profiles & skills | Users see own data |
| `applications` | Job applications | Users see own applications |
| `status_history` | Event log (audit) | Users see own history |
| `job_suggestions` | Discovered opportunities | Users see own suggestions |
| `skill_demand` | Market analysis data | Users see own skill data |
| `learning_tasks` | Generated learning activities | Users see own tasks |
| `agent_audit_logs` | Agent action history | Users see own audit logs |
| `email_logs` | Email delivery tracking | Users see own email logs |
| `scheduled_jobs` | Job scheduling config | Users configure own jobs |

### Sealed Access (via RLS)

Each agent has row-level security policies:

```sql
-- Example: Mail Agent can only write StatusHistory with specific fields
CREATE POLICY "Mail Agent can create status history"
  ON status_history FOR INSERT
  WITH CHECK (detected_by = 'mail-listener-agent' AND auth.uid() = user_id);
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn
- Supabase account (free tier)
- (Optional) Resend API key for email
- (Optional) Gmail/Outlook credentials for email syncing

### Installation

```bash
# Clone repository
git clone https://github.com/Sandhyasrinivas0221/job-search-copilot.git
cd job-search-copilot

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
```

### Configuration

Edit `.env.local`:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email (required for daily summaries)
RESEND_API_KEY=re_xxx
SYSTEM_EMAIL_FROM=noreply@jobsearchcopilot.com

# Cron Security (for Vercel deployment)
CRON_SECRET=your-secure-random-string

# (Optional) Email polling
GMAIL_EMAIL=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Database Setup

1. Create Supabase project
2. Run migrations:
   ```sql
   -- In Supabase SQL Editor
   -- Paste contents of supabase/migrations/001_init.sql
   -- Paste contents of supabase/migrations/002_add_rls_and_approval_gates.sql
   ```

### Run Locally

```bash
npm run dev
```

Visit: `http://localhost:3000`

---

## 🔌 API & Scheduled Execution

### Manual Agent Trigger (for testing)

```bash
# Trigger Mail Listener
curl -X POST http://localhost:3000/api/agents/mail-listener \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user"}'

# Trigger Tracker
curl -X POST http://localhost:3000/api/agents/tracker \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user"}'
```

### Vercel Cron Deployment

On Vercel, the `vercel.json` file automatically configures cron jobs:

```json
{
  "crons": [
    { "path": "/api/cron/mail-listener", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/tracker", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/role-finder", "schedule": "0 * * * *" },
    { "path": "/api/cron/market-scanner", "schedule": "0 11 * * *" },
    { "path": "/api/cron/gap-closer", "schedule": "0 8 * * *" },
    { "path": "/api/cron/metrics-reporter", "schedule": "0 9 * * *" }
  ]
}
```

Agents run automatically on the specified schedules.

---

## 🎯 Usage Examples

### Create a Test User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "full_name": "Test User",
    "skills": ["JavaScript", "React", "Node.js", "PostgreSQL"]
  }'
```

### Simulate Email Processing

```bash
curl -X POST http://localhost:3000/api/agents/mail-listener \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user",
    "emails": [{
      "from": "recruiter@company.com",
      "subject": "Interview Scheduled - Senior Developer at TechCorp",
      "body": "We would like to schedule an interview for next week...",
      "timestamp": "2026-02-13T10:00:00Z"
    }]
  }'
```

### View Dashboard Metrics

```bash
curl http://localhost:3000/api/metrics?userId=demo-user
```

---

## 🔒 Security & Data Isolation

### Row-Level Security (RLS)

All tables have RLS enabled:
- Users can only see their own data
- Agents can only write to specific tables with specific fields
- Audit logs track all agent actions

### Sealed Abilities Enforcement

Each agent is restricted via TypeScript + RLS:

```typescript
// ❌ Mail Agent CANNOT do this (typing prevents it)
async function maliciousApplyToJob() {
  // Cannot submit applications - NOT IN SEALED ABILITIES
  await supabase.from('applications').insert(...)  // Type error
}

// ✅ Mail Agent CAN do this (within sealed abilities)
async function processEmailEvent() {
  await supabase.from('status_history').insert(...)  // Allowed
}
```

### Approval Gates (Optional)

Sensitive operations can require approval:

```typescript
// When Mail Agent detects ambiguous event
await updateApplication({
  status_change_pending: true,  // Flag for approval
  current_status: 'NEEDS_REVIEW'
})

// User approves in UI before agent proceeds
```

---

## 📚 Adding New Agents

To add a new agent following Ship Faster patterns:

1. **Create skill directory**:
   ```bash
   mkdir -p skills/workflow-my-agent
   ```

2. **Create `skill.json`**:
   ```json
   {
     "id": "workflow-my-agent",
     "name": "My Agent",
     "sealed_abilities": {
       "can_read": ["table1"],
       "can_write": ["table2"],
       "cannot": ["sensitive_operation"]
     },
     "scheduling": {
       "default_cron": "0 */6 * * *"
     }
   }
   ```

3. **Implement `index.ts`**:
   ```typescript
   export async function runMyAgent(userId: string): Promise<Result> {
     // Agent logic
   }
   ```

4. **Create API route**:
   ```typescript
   // src/app/api/agents/my-agent/route.ts
   ```

5. **Add Vercel Cron** in `vercel.json`:
   ```json
   { "path": "/api/cron/my-agent", "schedule": "..." }
   ```

---

## 📊 Dashboard Features

- **Pipeline Kanban**: View applications by stage (APPLIED, SCREENING, INTERVIEW, OFFER, ARCHIVED)
- **Metrics**: Interview rate, offer rate, rejection rate, applications per week
- **Job Suggestions**: Ranked by match score with easy apply filters
- **Learning Plan**: Track skill development tasks with progress
- **Audit Trail**: View all agent actions and status changes

---

## 🛠️ Customization

### Add Job Board Source

Update `skills/workflow-role-finder/index.ts`:

```typescript
async function searchCustomJobBoard(): Promise<JobListingRaw[]> {
  // API call to your job board
  return [
    {
      title: "...",
      company: "...",
      url: "...",
      source: "custom-board",
      easyApply: true
    }
  ]
}
```

### Customize Email Template

Edit `src/lib/email-system.ts`:

```typescript
export function buildDailyEmailHTML(...): string {
  // Modify HTML template
}
```

### Change Skill Themes

Edit `skills/workflow-market-scanner/index.ts`:

```typescript
const SKILL_CLUSTERS = {
  "My Theme": ["skill1", "skill2"],
  // Add more themes
}
```

---

## 📈 Monitoring & Debugging

### View Agent Audit Logs

```sql
SELECT * FROM agent_audit_logs
WHERE user_id = 'demo-user'
ORDER BY created_at DESC;
```

### Check Email Delivery

```sql
SELECT * FROM email_logs
WHERE user_id = 'demo-user'
ORDER BY sent_at DESC;
```

### Monitor Job Storage

```sql
SELECT COUNT(*) FROM job_suggestions
WHERE user_id = 'demo-user' AND applied = false;
```

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Connect GitHub repository
vercel
```

Vercel automatically:
- Runs cron jobs per `vercel.json`
- Sets environment variables
- Handles scaling

### Self-Hosted

On any Node.js server:

```bash
npm run build
npm start

# Or use node-cron for job scheduling
# (See src/lib/scheduler.ts for patterns)
```

---

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Follow:
- Ship Faster skill conventions
- TypeScript strict mode
- Sealed ability boundaries
- Comprehensive logging

## 📞 Support

- **Issues**: GitHub Issues
- **Docs**: See SETUP.md, ARCHITECTURE.md, QUICKSTART.md
- **Examples**: See `/skills/` directory for agent patterns

---

**Built with ❤️ using Ship Faster patterns**

_"A multi-agent system that actually works like your personal team of job search specialists"_
