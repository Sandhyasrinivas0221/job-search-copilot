# Job Search Copilot 🚀

A comprehensive, multi-agent job search assistant built with Next.js 14, TypeScript, and Supabase. This intelligent system automates job application tracking, skill analysis, learning planning, and email synchronization to streamline your job search journey.

## 🎯 Features

### 6 Intelligent Agents

**1. Mail Agent – Inbox Listener**
- Automatically reads and parses emails from Gmail/Outlook
- Detects application status changes: received, interview scheduled, offer, rejection, OA sent
- Extracts company, role, and dates from email content
- Creates and updates Application records with StatusHistory
- Escalates ambiguous emails to NEEDS_REVIEW for manual verification

**2. Tracker Agent – Pipeline Manager**
- Derives application status from StatusHistory event log
- Auto-archives early rejections (screening stage)
- Marks applications as NO_RESPONSE if no updates for 14 days
- Suggests follow-up if APPLIED > 7 days without progress
- Maintains accurate daysInStage and lastUpdate metrics

**3. Job Market Agent – Role Finder**
- Searches multiple job boards (Indeed, LinkedIn, GitHub Jobs)
- Classifies jobs as EASY_APPLY vs MANUAL_APPLY
- Calculates match scores based on your skills
- Stores job suggestions with relevance data
- Escalates low interview rate to trigger strategy adjustments

**4. Skill Research Agent – Market Scanner**
- Analyzes job descriptions to extract required skills
- Clusters skills into themes (Java Core, Spring, Microservices, Cloud, etc.)
- Tracks skill frequency and detects rising trends
- Identifies skill gaps between your profile and market demand
- Provides data for Learning Planner prioritization

**5. Learning Planner Agent – Gap Closer**
- Generates weekly learning plans based on skill demand
- Creates interview prep packs for roles where rejections occurred
- Produces structured learning tasks with resources
- Links learning tasks to specific applications
- Escalates repeated rejections at same stage for targeted coaching

**6. System Observer Agent – Metrics & Daily Email**
- Computes dashboards: applications per week, interview rate, offer rate
- Builds daily and weekly summary views
- Sends email at 9:00 AM with job recommendations
- Generates easy-apply and manual-apply job classifications
- Detects escalations (e.g., zero interview rate) and alerts other agents

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Scheduling**: next-cron/node-cron (for agent triggers)
- **Email**: Resend API (optional, can be customized)

### Sealed Abilities

Each agent has strict boundaries to prevent conflicts:

| Agent | Can Do | Cannot Do |
|-------|--------|-----------|
| Mail Agent | Read emails, create/update apps | Send emails, apply to jobs |
| Tracker Agent | Update status, archive apps | Read raw emails, create apps |
| Job Market Agent | Search jobs, create suggestions | Submit applications |
| Skill Research Agent | Analyze descriptions, extract skills | Modify Applications table |
| Learning Planner Agent | Create learning tasks, gen plans | Apply to jobs, change statuses |
| System Observer Agent | Read all records, compute metrics | Modify any data |

### Database Schema

```sql
users                 -- User profiles and skills
applications          -- Job applications with metadata
status_history        -- Event log of application status changes
job_suggestions       -- Discovered roles awaiting review
skill_demand          -- Market skill analysis and trends
learning_tasks        -- Generated learning activities
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (https://supabase.com)
- (Optional) Resend account for email (https://resend.com)
- (Optional) Gmail/Outlook IMAP credentials for email sync

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd job-search-copilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```

   Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Set up Supabase database**
   ```bash
   # Connect to Supabase and run the migration
   # Copy contents of supabase/migrations/001_init.sql
   # Paste into Supabase SQL editor and execute
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   ```
   http://localhost:3000
   ```

## 📚 API Reference

### Agent Trigger Endpoints

**Mail Agent**
```bash
POST /api/agents/mail
Content-Type: application/json

{
  "userId": "user-id",
  "emails": [
    {
      "from": "noreply@company.com",
      "subject": "Interview Scheduled for Senior Developer",
      "body": "...",
      "timestamp": "2026-02-13T10:00:00Z"
    }
  ]
}
```

**Tracker Agent**
```bash
POST /api/agents/tracker
{
  "userId": "user-id"
}

Response:
{
  "success": true,
  "metrics": {
    "applicationsByStage": { "APPLIED": 5, "INTERVIEW": 2, ... },
    "applicationsWithoutUpdate": [...],
    "needsFollowUp": [...],
    "earlyRejections": [...]
  }
}
```

**Job Market Agent**
```bash
POST /api/agents/job-market
{
  "userId": "user-id"
}

Response:
{
  "success": true,
  "jobsFound": 12,
  "suggestions": [...]
}
```

**Learning Planner Agent**
```bash
POST /api/agents/learning-planner
{
  "userId": "user-id"
}

Response:
{
  "success": true,
  "weeklyPlan": [
    {
      "topic": "System Design",
      "tasks": [...],
      "estimatedHours": 10,
      "resources": [...],
      "priority": "HIGH"
    }
  ]
}
```

**System Observer Agent**
```bash
POST /api/agents/system-observer
{
  "userId": "user-id",
  "sendEmail": true
}

Response:
{
  "success": true,
  "metrics": { ... },
  "escalations": { "lowInterviewRate": false }
}
```

### Data Retrieval Endpoints

**Get Metrics**
```bash
GET /api/metrics?userId=user-id
```

**Get Applications**
```bash
GET /api/applications?userId=user-id
```

**Get Job Suggestions**
```bash
GET /api/suggestions?userId=user-id&applied=false&dismissed=false
```

**Get Learning Tasks**
```bash
GET /api/learning-tasks?userId=user-id&completed=false
```

## 🎨 Dashboard Components

- **Home**: Overview with key metrics
- **Pipeline Board**: Kanban-style view of applications by stage
- **Job Suggestions**: Recommended roles sorted by match score
- **Metrics**: Detailed analytics (interview rate, offer rate, top companies)
- **Learning Plan**: Skill development tasks and progress tracking

## 🔧 Customization

### Adding New Job Sources

Edit `src/agents/job-market-agent.ts`:

```typescript
private simulateCustomJobResults(): JobListingRaw[] {
  const roles = [
    {
      title: "...",
      company: "...",
      url: "...",
      source: "custom-board",
      easyApply: true,
    },
  ]
  return roles
}
```

### Modifying Email Detection Patterns

Edit `src/agents/mail-agent.ts`:

```typescript
const EMAIL_PATTERNS = {
  applicationReceived: [
    /your-custom-pattern/i,
  ],
  // ...
}
```

### Adjusting Escalation Thresholds

```typescript
// src/agents/tracker-agent.ts
const NO_RESPONSE_THRESHOLD_DAYS = 14      // Adjust as needed
const FOLLOW_UP_SUGGESTION_DAYS = 7        // Adjust as needed
```

## 📊 Understanding Agent Flow

```
User Inbox (Gmail/Outlook)
         ↓
    Mail Agent (reads emails, detects events)
         ↓
    Application + StatusHistory created/updated
         ↓
    Tracker Agent (runs periodically)
         ↓
    Updates daysInStage, marks NO_RESPONSE, archives rejections
         ↓
    Job Market Agent (searches job boards)
         ↓
    Creates JobSuggestion records
         ↓
    Skill Research Agent (analyzes descriptions)
         ↓
    Updates SkillDemand with trends
         ↓
    Learning Planner Agent (plans based on skills + rejections)
         ↓
    Creates LearningTask records
         ↓
    System Observer Agent (computes metrics, sends email)
         ↓
    Dashboard + Email notifications
```

## 🛡️ Error Handling & Logging

All agents include:
- Comprehensive try-catch blocks
- Detailed console logging with [AgentName] prefix
- Graceful escalation to NEEDS_REVIEW for ambiguous scenarios
- Error tracking in StatusHistory for visibility

Example:
```
[MailAgent] Processing 5 emails for user abc123
[MailAgent] Detected event: INTERVIEW_SCHEDULED from recruiter@company.com
[MailAgent] Created status history entry for TechCorp Senior Developer role
[TrackerAgent] Marked TechCorp as FOLLOW_UP_SUGGESTED after 7 days
```

## 📋 Environment Variables

See `.env.local.example` for complete list. Key variables:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email (optional)
RESEND_API_KEY=
SYSTEM_EMAIL_FROM=
SYSTEM_EMAIL_TO=

# Email Sync (optional)
GMAIL_EMAIL=
GMAIL_APP_PASSWORD=
OUTLOOK_EMAIL=
OUTLOOK_PASSWORD=

# Agent Intervals (milliseconds)
MAIL_AGENT_CHECK_INTERVAL=300000        # 5 minutes
TRACKER_AGENT_CHECK_INTERVAL=600000     # 10 minutes
JOB_MARKET_AGENT_CHECK_INTERVAL=3600000 # 1 hour
```

## 🤝 Contributing

Contributions welcome! Please:

1. Follow the TypeScript strict mode conventions
2. Maintain sealed boundaries between agents
3. Add comprehensive logging
4. Include error handling
5. Update documentation for new features

## 📄 License

MIT

## 🙋 Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with ❤️ for job seekers everywhere**
