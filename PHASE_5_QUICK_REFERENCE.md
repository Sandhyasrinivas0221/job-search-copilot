# Phase 5: Learning Path Service - Quick Reference & Testing Guide

## 🚀 Quickstart

### What Phase 5 Does

Takes your job applications → Extracts skills needed → Identifies gaps → Recommends learning paths with FREE resources

**Example Flow:**
```
Job Application: "Senior Backend Engineer at Google"
  ↓
Extracted Skills: Java, Spring, System Design, Microservices, Kubernetes
  ↓
Your Current Skills: Java, Spring
  ↓
Skill Gaps: System Design, Microservices, Kubernetes → CRITICAL priority
  ↓
Recommendation:
  - System Design: 30 hours (5 FREE resources)
  - Microservices: 20 hours (5 FREE resources)
  - Kubernetes: 25 hours (5 FREE resources)
  - Transition Options: DevOps Engineer (2 months, 70% skill match)
  - Market Demand: HIGH (System Design appearing in 145+ job postings)
```

## 🧪 Testing Phase 5

### 1. Via API Endpoint

```bash
# Test with test user (make sure user exists in db first)
curl -X POST "http://localhost:3000/api/cron/trigger-learning-paths?userId=00000000-0000-0000-0000-000000000001"

# Expected Response (simplified):
{
  "success": true,
  "applicationsAnalyzed": 3,
  "recommendations": [
    {
      "jobTitle": "Senior Backend Engineer",
      "company": "Google",
      "priority": "CRITICAL",
      "totalEstimatedHours": 120,
      "skillGaps": [
        {
          "name": "System Design",
          "priority": "CRITICAL",
          "marketFrequency": 127,
          "estimatedHours": 30,
          "topResources": [
            {
              "title": "System Design Fundamentals",
              "url": "https://www.youtube.com/watch?v=xpDnVSmNFwY",
              "type": "course",
              "platform": "ByteByteGo (YouTube)",
              "estimatedHours": 10
            }
          ]
        }
      ],
      "recommendedSkills": [
        {
          "skillName": "System Design",
          "difficulty": "INTERMEDIATE",
          "relevanceScore": 95,
          "estimatedHours": 30,
          "resources": [...]
        }
      ],
      "transitionRoles": [
        {
          "title": "DevOps Engineer",
          "skillMatch": 40,
          "estimatedMonths": 2
        }
      ]
    }
  ],
  "summary": {
    "highPriorityJobs": 2,
    "totalLearningHours": 320,
    "topTrendingSkills": ["System Design", "Kubernetes", "AWS"]
  }
}
```

### 2. Via TypeScript (Direct)

```typescript
// In a test file or component
import { LearningPathService } from "@/lib/learning-path-service"
import { getApplications } from "@/lib/db"

async function testLearningPaths() {
  const userId = "test-user-id"

  // Initialize service
  const service = new LearningPathService(userId)
  await service.initialize()

  // Generate recommendations
  const recs = await service.generateRecommendationsForAllApplications()

  console.log(`Generated ${recs.length} recommendations`)

  recs.forEach(rec => {
    console.log(`\n📋 ${rec.jobTitle} at ${rec.company}`)
    console.log(`   Priority: ${rec.priority}`)
    console.log(`   Learning Hours: ${rec.totalEstimatedHours}`)
    console.log(`   Skill Gaps: ${rec.skillGaps.map(g => g.skillName).join(", ")}`)
    console.log(`   Transitions: ${rec.transitionRoles.map(t => t.title).join(", ")}`)
  })
}

// Or for a specific application
async function testSingleApplication() {
  const app = await getApplication("app-id")
  const service = new LearningPathService("user-id")
  await service.initialize()

  const rec = await service.generateRecommendationForApplication(app)
  console.log(JSON.stringify(rec, null, 2))
}
```

### 3. Manual Setup for Testing

**Create test user:**
```sql
-- Add to public.users (if not already there)
INSERT INTO public.users (id, email, full_name, skills, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  'Test User',
  '["Java", "Spring"]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

**Add test application:**
```sql
INSERT INTO applications (
  user_id, company_name, job_title, description, current_status,
  applied_date, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Google',
  'Senior Backend Engineer',
  'Required: Java, Spring Boot, System Design, Microservices, AWS, Kubernetes.
   Build scalable backend systems serving billions of users.',
  'INTERVIEW',
  NOW(),
  NOW(),
  NOW()
);
```

**Add trending skills (so market analysis works):**
```sql
INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'System Design', 'System Design', 127, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'Kubernetes', 'Microservices', 95, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'AWS', 'Cloud', 150, true, NOW(), NOW());
```

## 📊 Understanding the Output

### Priority Levels

| Priority | Trigger | Action |
|----------|---------|--------|
| **CRITICAL** | Interview stage + 2+ skill gaps + HIGH market demand | Start learning immediately |
| **HIGH** | 3+ skill gaps OR interview stage with trending skills | Prioritize this week |
| **MEDIUM** | Trending skills OR single critical gap | Learn alongside other tasks |
| **LOW** | Stable (non-trending) skills, single gap | Learn when time permits |

### Market Demand Levels

| Level | Meaning | Action |
|-------|---------|--------|
| **HIGH** | 2+ trending skills required OR 50+ job postings | Very marketable, learn it |
| **MEDIUM** | Mix of trending & stable skills | Good career move |
| **LOW** | Mostly non-trending skills | Optional/specialized |

### Skill Gap Priority

| Priority | Market Frequency | Appears in Offers | Learning Time |
|----------|-----------------|------------------|----------------|
| **CRITICAL** | 100+ | 10+ | < 50 hours |
| **HIGH** | 50-100 | 5-10 | 50-100 hours |
| **MEDIUM** | 20-50 | 2-5 | 100+ hours |

## 🎯 Expected Recommendations

### Example 1: Backend Developer → More Backend (Quick Win)

```
Job: "Senior Backend Engineer at Amazon"
Required: Java, Spring, AWS, System Design
Your Skills: Java, Spring
Gaps: AWS (MEDIUM), System Design (CRITICAL)

Output:
- System Design: 30 hours, CRITICAL priority
- AWS: 18 hours, MEDIUM priority
- Transitions: DevOps Engineer (2 months, 45% match)
- Market Demand: HIGH
- Total: 48 hours
```

### Example 2: Backend → Frontend (Transition Path)

```
Job: "React Developer at Startups"
Required: React, JavaScript, CSS, TypeScript
Your Skills: Java, Spring (backend)
Gaps: React (CRITICAL), JavaScript (CRITICAL), CSS (HIGH), TypeScript (HIGH)

Output:
- React: 25 hours, CRITICAL priority
- JavaScript: 15 hours, CRITICAL priority
- CSS: 12 hours, HIGH priority
- TypeScript: 8 hours, HIGH priority
- Transitions: Full Stack Engineer (4 months, 50% match)
- Market Demand: HIGH (React in 200+ postings)
- Total: 60 hours
```

### Example 3: New Graduate → First Job

```
Job: "Junior Backend Engineer at Startup"
Required: Node.js, Express, MongoDB, REST APIs, Git
Your Skills: (minimal/none)
Gaps: All are BEGINNER level but MEDIUM priority

Output:
- Node.js: 20 hours (BEGINNER course)
- Express: 15 hours (BEGINNER tutorial)
- MongoDB: 12 hours (BEGINNER course)
- REST APIs: 8 hours (BEGINNER article)
- Transitions: Full Stack (6 months, 30% match)
- Market Demand: MEDIUM
- Total: 55 hours, recommended BEGINNER resources
```

## 🔧 Customization Options

### 1. Adjust Skill Extraction Keywords

Edit `extractSkillsFromJobDescription()` in `learning-path-service.ts`:

```typescript
const skillPatterns: Record<string, string[]> = {
  "java-core": ["java", "oop", "concurrency", "jvm"], // Add more patterns
  "rust": ["rust", "unsafe", "cargo"],  // Add new skill categories
  // ...
}
```

### 2. Add New Transition Roles

Edit `suggestTransitionRoles()`:

```typescript
const transitionMap: Record<string, TransitionRoleOption[]> = {
  "mobile": [
    {
      title: "Backend Engineer",
      description: "Use mobile optimization knowledge for backend APIs",
      // ...
    }
  ]
}
```

### 3. Change Priority Calculations

Edit `calculatePriority()` to weight factors differently:

```typescript
if (status === ApplicationStatus.INTERVIEW && gapCount > 2) return "CRITICAL"
// Add more conditions, adjust thresholds, etc.
```

## 🐛 Debugging

### No recommendations generated?

```typescript
// Check if applications exist
const apps = await getApplications(userId)
console.log(`Found ${apps.length} applications`)

// Check if service initialized
const service = new LearningPathService(userId)
await service.initialize()
console.log(`User: ${service['user']?.full_name}`)
console.log(`Trending skills: ${service['trendingSkills'].length}`)

// Check if skills are extracted
const app = apps[0]
const skills = service['extractSkillsFromJobDescription'](app.description || '', app.job_title || '')
console.log(`Extracted skills: ${skills.join(", ")}`)
```

### Wrong difficulty level recommended?

```typescript
// Check skill gap priority calculation
const gaps = await service['identifySkillGaps'](["system-design"])
console.table(gaps.map(g => ({ name: g.skillName, priority: g.priority, hours: g.estimatedHoursToAcquire })))
```

### Missing or incorrect resources?

```typescript
// Verify resources are loaded
import { ALL_SKILL_PATHS } from "@/lib/learning-resources"
console.log(`Total skill paths: ${Object.keys(ALL_SKILL_PATHS).length}`)

const path = ALL_SKILL_PATHS["system-design"]
console.table(path.learningPath.beginner.map(r => ({
  title: r.title,
  free: r.free,
  hours: r.estimatedHours
})))
```

## 📈 Next Steps After Phase 5

1. **Store Recommendations** (Phase 6)
   - Save to database for history tracking
   - Compare recommendations over time

2. **Visualize Recommendations** (Phase 7)
   - Dashboard cards for each job's learning path
   - Progress bars for learning completion
   - Skill gap visualizations

3. **Export Learning Plans** (Phase 8)
   - Download as PDF/markdown
   - Share with mentors

4. **Real-time Analysis** (Phase 9)
   - Analyze 100s of free job listings
   - Feed trending skills to service
   - Market trend dashboard

## 🎓 All FREE Resources Included

**Example for "System Design" skill:**
- ByteByteGo YouTube Course (10h)
- GitHub System Design Primer (15h)
- Real-world architecture analysis (3h)
- Practice problems (4h)
- Engineering blogs (10h)

**Total: 42 hours, 0 USD**

## 🤝 Integration Checklist

Before running Phase 5 in production:

- [ ] Test user created in database
- [ ] Sample applications with descriptions added
- [ ] Trending skills populated (run Skill Research Agent first)
- [ ] All 10 skill paths verified in learning-resources.ts
- [ ] Market demand data available
- [ ] User profile skills updated
- [ ] Test API endpoint works without errors

## Questions?

Refer to `PHASE_5_LEARNING_PATH_SERVICE.md` for full documentation.

Key sections:
- Architecture & data flow
- All interface definitions
- Integration with other agents
- Usage examples and patterns
