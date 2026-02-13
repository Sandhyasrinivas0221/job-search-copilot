# Architecture Guide

Comprehensive documentation of the Job Search Copilot system architecture, design patterns, and agent responsibilities.

## System Overview

The Job Search Copilot is a multi-agent system where each agent has a specific responsibility and sealed boundaries. Agents operate independently on a schedule, reading/writing to shared database tables, with minimal inter-agent communication.

```
┌─────────────────────────────────────────────────────────────┐
│                    Job Search Copilot                       │
├─────────────────────────────────────────────────────────────┤
│  External Inputs                                            │
│  ├── Email (Gmail/Outlook)                                  │
│  ├── Job Board APIs (Indeed, LinkedIn, GitHub)              │
│  └── User Dashboard Input                                   │
├─────────────────────────────────────────────────────────────┤
│  Agent Layer                                                │
│  ├── Mail Agent         (→ Applications, StatusHistory)     │
│  ├── Tracker Agent      (→ Update Applications)             │
│  ├── Job Market Agent   (→ JobSuggestions)                  │
│  ├── Skill Research Agent (→ SkillDemand)                   │
│  ├── Learning Planner Agent (→ LearningTasks)               │
│  └── System Observer Agent (→ Metrics, Email)               │
├─────────────────────────────────────────────────────────────┤
│  Shared Data Layer (Supabase PostgreSQL)                    │
│  ├── users              ├── status_history                  │
│  ├── applications       ├── job_suggestions                 │
│  ├── skill_demand       └── learning_tasks                  │
├─────────────────────────────────────────────────────────────┤
│  API & UI Layer                                             │
│  ├── REST APIs          ├── Dashboard                       │
│  └── Webhooks           └── Email Reports                   │
└─────────────────────────────────────────────────────────────┘
```

## Agent Specifications

### 1. Mail Agent

**Purpose**: Monitor inbox for application status changes

**Input**: Email messages (from, subject, body, timestamp)

**Processing**:
1. Detect email event type using regex patterns
2. Extract company name and job title
3. Find or create corresponding Application record
4. Create StatusHistory entry with detected status
5. Handle ambiguous cases → NEEDS_REVIEW

**Output**: Application, StatusHistory

**Sealed Abilities**:
- ✅ Can: Read emails, create/update Applications, create StatusHistory
- ❌ Cannot: Send emails, apply to jobs

**Escalation Logic**:
- If email event unclear → Set status to NEEDS_REVIEW
- If company/role not extractable → Log full email for manual review

### 2. Tracker Agent

**Purpose**: Manage application pipeline and auto-update statuses

**Input**: Applications table

**Processing**:
1. Calculate days since last update
2. Update daysInStage field
3. If APPLIED > 7 days → FOLLOW_UP_SUGGESTED
4. If no update > 14 days → NO_RESPONSE
5. If REJECTED and applied < 3 days → ARCHIVED

**Output**: Updated Applications, StatusHistory

**Sealed Abilities**:
- ✅ Can: Read Applications, update Applications, create StatusHistory
- ❌ Cannot: Read raw emails, create Applications, send emails

**Escalation Logic**:
- Low interview rate (0% with 5+ apps) → Alert other agents

### 3. Job Market Agent

**Purpose**: Discover and recommend job opportunities

**Input**: User profile (skills, preferences)

**Processing**:
1. Search multiple job boards (simulated)
2. Filter by skills and location
3. Calculate match score (0-100)
4. Classify as EASY_APPLY or MANUAL_APPLY
5. Check for duplicates before creating

**Output**: JobSuggestions

**Sealed Abilities**:
- ✅ Can: Search jobs, create JobSuggestions, calculate scores
- ❌ Cannot: Submit applications, modify Applications table

**Escalation Logic**:
- If high rejection rate detected → Widen search criteria
- If offers increase → Prioritize similar roles

### 4. Skill Research Agent

**Purpose**: Analyze market demand and identify skill gaps

**Input**: Job descriptions from applications

**Processing**:
1. Extract skills using regex patterns
2. Count skill frequency across jobs
3. Cluster skills by theme (Java Core, Spring, Cloud, etc.)
4. Detect rising trends (more in offers than rejections)
5. Update SkillDemand table

**Output**: SkillDemand with frequency and trend data

**Sealed Abilities**:
- ✅ Can: Analyze descriptions, create/update SkillDemand
- ❌ Cannot: Modify Applications, modify JobSuggestions

**Escalation Logic**:
- If trending skill missing from profile → Alert Learning Planner

### 5. Learning Planner Agent

**Purpose**: Generate personalized learning plans

**Input**: SkillDemand (trending skills), rejection history

**Processing**:
1. Identify trending skills
2. Analyze rejection patterns by stage
3. Create weekly learning plan
4. Generate interview prep packs for roles with 2+ rejections
5. Link tasks to specific applications

**Output**: LearningTasks with resources and estimated hours

**Sealed Abilities**:
- ✅ Can: Create LearningTasks, access rejection history
- ❌ Cannot: Apply to jobs, change application statuses

**Escalation Logic**:
- If repeated rejections at same stage → Increase focus on that area
- If missing key trending skill → High priority task

### 6. System Observer Agent

**Purpose**: Compute metrics and send daily summaries

**Input**: All tables (read-only)

**Processing**:
1. Calculate rates (interview, offer, rejection)
2. Compute days per stage metrics
3. Identify top companies and rejection reasons
4. Build daily email summary
5. Detect escalations

**Output**: Metrics JSON, Email summary

**Sealed Abilities**:
- ✅ Can: Read from all tables, compute metrics, format emails
- ❌ Cannot: Modify any data

**Escalation Logic**:
- If interview rate drops to 0 → Alert Job Market + Learning Planner

## Data Models

### Application Status Flow

```
APPLIED
  ↓ (3 days, no response)
  ├→ REJECTED (end state)
  └→ SCREENING (OA sent)
      ↓
      ├→ REJECTED (end state)
      └→ INTERVIEW
          ↓
          ├→ REJECTED (end state)
          ├→ OFFER
          │   ↓
          │   ├→ ACCEPTED (end state)
          │   └→ REJECTED (end state)
          └→ NO_RESPONSE (14 days, no update)

Special states:
- FOLLOW_UP_SUGGESTED: APPLIED > 7 days, no progress
- NEEDS_REVIEW: Ambiguous email detected
- ARCHIVED: Auto-archived early rejection
```

### Database Relationships

```
users (1) ────────── (many) applications
         │
         ├────────── (many) status_history
         │
         ├────────── (many) job_suggestions
         │
         ├────────── (many) skill_demand
         │
         └────────── (many) learning_tasks

applications (1) ───── (many) status_history
            (1) ───── (many) learning_tasks
```

## Sealed Boundaries

### Why Sealed Boundaries?

1. **Prevent Conflicts**: Mail Agent can't apply to jobs (Mail Agent doesn't have job URLs)
2. **Clear Contracts**: Each agent has well-defined input/output
3. **Auditability**: Track which agent made changes
4. **Scalability**: Agents can run independently without coordination
5. **Safety**: Reduces risk of bugs causing cascading failures

### How Enforcement Works

```typescript
// Sealed: Mail Agent can't directly access JobSuggestions
// ❌ WRONG:
async function mailAgent() {
  await updateJobSuggestion(...)  // Sealed boundary violation
}

// ✅ CORRECT:
async function mailAgent() {
  await updateApplication(...)    // Within sealed boundary
  await createStatusHistory(...)  // Within sealed boundary
}
```

## Error Handling & Escalation

### Error Levels

```
Level 1: Log Only
- Transient network errors
- Retry with backoff

Level 2: Create StatusHistory Entry
- Ambiguous email patterns
- Set status to NEEDS_REVIEW

Level 3: Alert User
- Zero interview rate
- Missing key skills
- Email notification

Level 4: Manual Review Required
- System failures
- Data integrity issues
```

### Example Escalation

```typescript
// Mail Agent detects ambiguous email
if (eventType === EmailEventType.UNKNOWN) {
  // Escalation: Can't determine status
  await createStatusHistory({
    new_status: ApplicationStatus.NEEDS_REVIEW,
    reason: "Email event type unclear",
    notes: email.body,  // Full email for manual review
    detected_by: "MailAgent"
  })
}

// System Observer Agent should alert user
// "Application requires manual review - check email"
```

## Agent Scheduling

### Execution Timeline

```
Time    Agent                      Action
-----   ------------------------   ---------------------------
5 min   Mail Agent                 Poll emails
10 min  Tracker Agent              Update pipeline
1 hr    Job Market Agent           Search jobs
8 am    Learning Planner Agent     Generate weekly plan
9 am    System Observer Agent      Send daily email
11 am   Skill Research Agent       Analyze market trends
```

### Concurrency Handling

Agents run independently - database handles concurrency:

```
Mail Agent                  Tracker Agent
├─ Read Application         ├─ Read Application
├─ Update status            ├─ Update daysInStage
└─ Insert StatusHistory     └─ Insert StatusHistory
         ↓
      (Database handles row-level locking)
```

## Type Safety

All data flows through TypeScript interfaces:

```typescript
// Sealed type: Mail Agent input
interface EmailParsed {
  from: string
  subject: string
  body: string
  timestamp: string
}

// Sealed type: Mail Agent output
interface StatusHistory {
  application_id: string
  new_status: ApplicationStatus
  reason: string
  detected_by: "MailAgent"
}
```

## Performance Optimization

### Query Optimization

- Indexes on frequently queried columns (user_id, status, created_at)
- Eager loading via joins where needed
- Pagination for large result sets

### Caching Strategy

For read-heavy operations:
```typescript
// System Observer Agent metrics
const metrics = await cacheOrCompute(
  `metrics-${userId}`,
  () => computeMetrics(userId),
  { ttl: 3600 }  // Cache 1 hour
)
```

### Batch Operations

For bulk updates:
```typescript
// Tracker Agent processes multiple apps
const updates = applications.map(app => ({
  id: app.id,
  days_in_stage: calculateDays(app)
}))
await batchUpdate('applications', updates)
```

## Monitoring & Logging

### Log Structure

```typescript
[AgentName] [Level] [Context] Message
[MailAgent] [INFO] [email=recruiter@company.com] Detected: INTERVIEW_SCHEDULED
[Tracker] [WARN] [app=abc123] No response after 14 days
[System] [ERROR] [agent=JobMarket] Failed to fetch jobs: 500 Internal Error
```

### Metrics to Track

- Agent execution time
- Record creation/update counts
- Error rates per agent
- Email detection accuracy
- Interview rate trend

## Future Enhancements

1. **Agent-to-Agent Communication**
   - Job Market Agent → Learning Planner: "Widen search"
   - System Observer → Skill Research: "Reanalyze trending"

2. **Machine Learning**
   - Predict interview probability
   - Optimize follow-up timing
   - Pattern detection in rejections

3. **Advanced Scheduling**
   - Adaptive intervals based on activity
   - Priority-based queue for agents

4. **Multi-User Support**
   - Per-user agent instances
   - Shared recommendations across users

---

For implementation questions, refer to individual agent files in `src/agents/`
