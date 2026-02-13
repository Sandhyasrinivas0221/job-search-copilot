# Ship Faster Integration Guide

This document explains how Job Search Copilot has been enhanced using Ship Faster framework patterns.

## What is Ship Faster?

Ship Faster is an open-source framework that provides patterns for building autonomous, multi-step system agents. Read more: https://github.com/Heyvhuang/ship-faster

### Key Ship Faster Patterns We Adopted

1. **Skills-Based Architecture** - Reusable, composable agent definitions
2. **Sealed Boundaries** - Clear input/output contracts for each agent
3. **Metadata-Driven Design** - `skill.json` files defining agent capabilities
4. **Workflow Patterns** - Multi-step processes with checkpoints
5. **Service Integration** - Database operations with approval gates
6. **Audit Trail** - Complete history of all agent actions

---

## How We Applied Ship Faster Patterns

### 1. Skills Directory Structure

**Before:**
```
src/agents/
├── mail-agent.ts
├── tracker-agent.ts
└── ...
```

**After (Ship Faster):**
```
skills/
├── workflow-mail-listener/
│   ├── skill.json              ← Metadata
│   ├── index.ts                ← Implementation
│   └── readme.md               ← Documentation
├── workflow-tracker/
├── workflow-role-finder/
└── ... (6 total agents)
```

**Benefits:**
- Clear agent separation
- Reusable skill definitions
- Easy to discover and extend
- Follows Ship Faster conventions

### 2. Skill Metadata (`skill.json`)

Every agent has a `skill.json` that documents:

```json
{
  "id": "workflow-mail-listener",
  "name": "Mail Listener Agent",
  "sealed_abilities": {
    "can_read": ["emails"],
    "can_write": ["applications", "status_history"],
    "cannot": ["send_emails", "apply_to_jobs"]
  },
  "scheduling": {
    "default_cron": "*/5 * * * *",
    "description": "Run every 5 minutes"
  },
  "escalation_rules": [
    {
      "condition": "ambiguous_email_event",
      "action": "set_status_to_NEEDS_REVIEW"
    }
  ]
}
```

**Benefits:**
- Self-documenting agent capabilities
- Easy permission management
- Clear escalation paths
- Facilitates agent discovery

### 3. Sealed Boundaries

**Problem:** Agents could accidentally or maliciously access/modify data they shouldn't

**Ship Faster Solution:** Multiple layers of protection

```
Layer 1: TypeScript API Design
  export function runMailListenerAgent(...)  // Exported API

Layer 2: Row-Level Security (RLS)
  CREATE POLICY "Mail Agent can create status history"
    ON status_history FOR INSERT
    WITH CHECK (detected_by = 'mail-listener-agent')

Layer 3: Sealed Abilities Documentation
  skill.json: { "can_write": ["status_history"], "cannot": ["applications"] }
```

**Benefits:**
- Type safety prevents programming errors
- Database policies prevent unauthorized access
- Clear documentation prevents intent errors

### 4. Agent Audit Logging

**New Table:** `agent_audit_logs`

Every agent action is logged:

```typescript
await logAgentAction(userId, 'mail-listener-agent', {
  emails_processed: 5
}, {
  success: true,
  applicationsCreated: 2,
  applicationsUpdated: 1,
  escalations: 0
})
```

**Ship Faster Benefit:**
- Complete audit trail
- Debugging and troubleshooting
- Compliance and accountability
- Pattern discovery

### 5. Vercel Cron Integration

**Ship Faster Pattern:** Scheduled workflows

**Our Implementation:**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/mail-listener",
      "schedule": "*/5 * * * *"
    },
    ...
  ]
}
```

**Benefits:**
- Agents run autonomously
- No manual intervention needed
- Vercel handles reliability
- Easy to monitor and update

### 6. Escalation Rules

**Ship Faster Pattern:** Escalate ambiguous situations to human review

**Examples:**

```typescript
// Mail Agent: Ambiguous email
escalation: {
  condition: "ambiguous_email_event",
  action: "set_status_to_NEEDS_REVIEW"
}

// Tracker Agent: Stale application
escalation: {
  condition: "applied_7_days_no_progress",
  action: "set_status_FOLLOW_UP_SUGGESTED"
}

// System Observer: Low interview rate
escalation: {
  condition: "zero_interview_rate_5_plus_apps",
  action: "alert_job_market_and_learning_planner"
}
```

**Benefits:**
- Agents don't make risky decisions
- Humans stay in control
- Clear escalation paths
- Safe automation

### 7. Database Service Integration (RLS + Approval Gates)

**Ship Faster Pattern:** Gated write operations

**New Fields in `applications` Table:**

```sql
status_change_pending BOOLEAN DEFAULT false
status_change_approved_at TIMESTAMP WITH TIME ZONE
status_change_rejected_reason TEXT
```

**Use Case:**
```typescript
// Mail Agent detects ambiguous event
await updateApplication(appId, {
  status_change_pending: true,  // Flag for approval
  status_change: 'NEEDS_REVIEW'
})

// In UI, user reviews and approves
// Agent or user can then apply the change
```

**Benefits:**
- Sensitive operations can be reviewed
- Audit trail of approvals
- User control over automation
- Compliance support

---

## Ship Faster Concepts We Implemented

| Concept | What | Implementation |
|---------|------|----------------|
| **Skills** | Reusable agent definitions | `/skills/workflow-*` directories |
| **Sealed Abilities** | Restricted agent permissions | `skill.json` + RLS policies |
| **Metadata** | Skill documentation | `skill.json` files |
| **Workflows** | Multi-step processes | Agent sequences (Mail → Tracker → LearningPlanner) |
| **Service Integration** | DB operations with gates | Supabase RLS + approval tables |
| **Audit Trail** | Action history | `agent_audit_logs` table |
| **Escalation** | Human involvement | NEEDS_REVIEW status + audit logs |
| **Scheduling** | Automated execution | Vercel Cron jobs |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│           Ship Faster Framework Patterns                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Skill Definition          Sealed Boundaries            │
│  ┌──────────────────┐    ┌──────────────────────┐      │
│  │  skill.json      │───→│  TypeScript Types    │      │
│  │  - abilities     │    │  - APIs              │      │
│  │  - escalation    │    │  - Contracts         │      │
│  └──────────────────┘    └──────────────────────┘      │
│           ↓                      ↓                       │
│  ┌──────────────────┐    ┌──────────────────────┐      │
│  │  index.ts        │───→│  Supabase RLS        │      │
│  │  Agent Logic     │    │  - Policies          │      │
│  └──────────────────┘    │  - Approval Gates    │      │
│           ↓              └──────────────────────┘      │
│  ┌──────────────────┐            ↓                      │
│  │ Cron Scheduling  │    ┌──────────────────────┐      │
│  │  - Vercel Crons  │───→│  Audit Logging       │      │
│  │  - 6 Agents      │    │  - Every Action      │      │
│  └──────────────────┘    │  - Escalations       │      │
│                          └──────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## File Structure Comparison

### Before (Basic Multi-Agent)
```
src/agents/
  ├── mail-agent.ts           (350 lines)
  ├── tracker-agent.ts        (200 lines)
  └── ...
src/app/api/
  ├── agents/mail/route.ts
  └── ...
```

### After (Ship Faster Native)
```
skills/
  ├── workflow-mail-listener/
  │   ├── skill.json              ← Metadata
  │   ├── index.ts                ← Implementation
  │   └── types.ts                ← Sealed types
  ├── workflow-tracker/
  ├── workflow-role-finder/
  ├── workflow-market-scanner/
  ├── workflow-gap-closer/
  └── workflow-metrics-reporter/
src/lib/
  ├── agent-logger.ts             ← Audit trail
  ├── scheduled-jobs.ts           ← Cron config
  └── email-system.ts             ← Service integration
src/app/api/
  ├── agents/
  ├── cron/                       ← Vercel Cron routes
  └── ...
supabase/
  └── migrations/
      ├── 001_init.sql
      └── 002_add_rls_and_approval_gates.sql
```

---

## Adding a New Agent (Ship Faster Style)

### Step 1: Create Skill Directory
```bash
mkdir -p skills/workflow-my-feature
```

### Step 2: Define `skill.json`
```json
{
  "id": "workflow-my-feature",
  "name": "My Feature Agent",
  "version": "1.0.0",
  "category": "workflow",
  "sealed_abilities": {
    "can_read": ["table1"],
    "can_write": ["table2"],
    "cannot": ["sensitive_ops"]
  },
  "escalation_rules": [...],
  "scheduling": {
    "default_cron": "0 * * * *"
  }
}
```

### Step 3: Implement `index.ts`
```typescript
export async function runMyFeatureAgent(userId: string): Promise<Result> {
  // Agent logic with logging via logAgentAction()
}
```

### Step 4: Create API Route
```typescript
// src/app/api/agents/my-feature/route.ts
// src/app/api/cron/my-feature/route.ts
```

### Step 5: Add to `vercel.json`
```json
{
  "path": "/api/cron/my-feature",
  "schedule": "0 * * * *"
}
```

### Step 6: Update Database RLS
```sql
CREATE POLICY "My Feature Agent can write to table2"
  ON table2 FOR INSERT
  WITH CHECK (agent_name = 'my-feature-agent');
```

Done! Your agent follows Ship Faster conventions.

---

## Security Benefits

### Before
- Agents could access any table
- No audit trail
- No escalation mechanism
- Difficult to verify boundaries

### After (Ship Faster)
- ✅ Agents restricted by RLS policies
- ✅ Complete audit trail in `agent_audit_logs`
-  ✅ Clear escalation to `NEEDS_REVIEW`
- ✅ Sealed abilities documented in `skill.json`
- ✅ Approval gates for sensitive operations
- ✅ Type-safe APIs prevent errors

---

## Monitoring Ship Faster Agents

### View Agent Activity
```sql
SELECT agent_name, COUNT(*) as actions, status
FROM agent_audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_name, status;
```

### Check Escalations
```sql
SELECT * FROM agent_audit_logs
WHERE status = 'ESCALATED'
ORDER BY created_at DESC;
```

### Monitor Specific Agent
```sql
SELECT * FROM agent_audit_logs
WHERE agent_name = 'workflow-mail-listener'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Ship Faster Resources

- **GitHub**: https://github.com/Heyvhuang/ship-faster
- **Patterns Used**: workflow-*, service integration, sealed abilities
- **Community**: Contribute back improvements to Ship Faster!

---

## Next Steps

1. **Deploy to Vercel** - Agents run automatically on schedule
2. **Monitor Audit Logs** - Track what agents are doing
3. **Extend with New Skills** - Follow the pattern for new features
4. **Tune Escalations** - Adjust what requires human review
5. **Integrate with your systems** - Connect real email/job APIs

---

**Your job search copilot is now Ship Faster-native! 🚀**
