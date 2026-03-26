# Multi-User Testing & Verification Guide

**Version**: 1.0.0
**Created**: 2026-03-26
**Purpose**: Verify all agents work correctly with multiple users

---

## 🧪 Pre-Deployment Multi-User Testing

###  Test 1: Create 3 Test Users

```sql
-- Test User 1: Backend Developer
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'backend-dev@test.local',
  crypt('Test@123456', gen_salt('bf')),
  NOW()
);

INSERT INTO public.users (id, email, full_name, skills)
SELECT id, email, 'Backend Developer', '["Java", "Spring", "PostgreSQL"]'::jsonb
FROM auth.users WHERE email = 'backend-dev@test.local';

-- Test User 2: Frontend Developer
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'frontend-dev@test.local',
  crypt('Test@123456', gen_salt('bf')),
  NOW()
);

INSERT INTO public.users (id, email, full_name, skills)
SELECT id, email, 'Frontend Developer', '["React", "TypeScript", "CSS"]'::jsonb
FROM auth.users WHERE email = 'frontend-dev@test.local';

-- Test User 3: Full Stack Developer
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'fullstack-dev@test.local',
  crypt('Test@123456', gen_salt('bf')),
  NOW()
);

INSERT INTO public.users (id, email, full_name, skills)
SELECT id, email, 'Full Stack Developer', '["Node.js", "React", "MongoDB"]'::jsonb
FROM auth.users WHERE email = 'fullstack-dev@test.local';

-- Verify users created
SELECT id, email, full_name, skills FROM public.users
WHERE email LIKE '%@test.local' ORDER BY created_at;
```

### Test 2: Create Sample Applications for Each User

```bash
# Get user IDs
USER1_ID=$(curl -s "http://localhost:3000/api/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

USER2_ID=$(curl -s "http://localhost:3000/api/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[1].id')

USER3_ID=$(curl -s "http://localhost:3000/api/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[2].id')

# User 1: Backend roles
curl -X POST "http://localhost:3000/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER1_ID'",
    "company_name": "Google",
    "job_title": "Senior Backend Engineer",
    "description": "Seeking: Java, Spring Boot, Microservices, System Design, AWS, 5+ YOE",
    "current_status": "INTERVIEW"
  }'

curl -X POST "http://localhost:3000/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER1_ID'",
    "company_name": "Meta",
    "job_title": "Backend Engineer",
    "description": "Tech: Java, Kafka, Distributed Systems, Golang",
    "current_status": "APPLIED"
  }'

# User 2: Frontend roles
curl -X POST "http://localhost:3000/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER2_ID'",
    "company_name": "Meta",
    "job_title": "Senior Frontend Engineer",
    "description": "Required: React, TypeScript, GraphQL, Redux, Testing",
    "current_status": "INTERVIEW"
  }'

curl -X POST "http://localhost:3000/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER2_ID'",
    "company_name": "Netflix",
    "job_title": "UI Engineer",
    "description": "Tech: React, CSS-in-JS, Performance optimization",
    "current_status": "SCREENING"
  }'

# User 3: Full Stack roles
curl -X POST "http://localhost:3000/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER3_ID'",
    "company_name": "Stripe",
    "job_title": "Full Stack Engineer",
    "description": "Stack: Node.js, React, PostgreSQL, AWS, Docker",
    "current_status": "APPLIED"
  }'
```

### Test 3: Add Trending Skills for Market Analysis

```sql
-- Add trending skills for backend
INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, appears_in_offers, appears_in_rejections)
SELECT u.id, 'System Design', 'System Design', 145, TRUE, 12, 3
FROM public.users u WHERE u.email LIKE '%backend%@test.local';

INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, appears_in_offers, appears_in_rejections)
SELECT u.id, 'Kubernetes', 'Microservices', 95, TRUE, 8, 2
FROM public.users u WHERE u.email LIKE '%backend%@test.local';

-- Add trending skills for frontend
INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, appears_in_offers, appears_in_rejections)
SELECT u.id, 'React', 'Frontend', 200, TRUE, 15, 4
FROM public.users u WHERE u.email LIKE '%frontend%@test.local';

INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, appears_in_offers, appears_in_rejections)
SELECT u.id, 'TypeScript', 'Frontend', 180, TRUE, 14, 3
FROM public.users u WHERE u.email LIKE '%frontend%@test.local';

-- Add trending skills for fullstack
INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, appears_in_offers, appears_in_rejections)
SELECT u.id, 'Docker', 'Microservices', 120, TRUE, 10, 2
FROM public.users u WHERE u.email LIKE '%fullstack%@test.local';

INSERT INTO skill_demand (user_id, skill_name, skill_category, frequency, rising_trend, appears_in_offers, appears_in_rejections)
SELECT u.id, 'AWS', 'Cloud', 175, TRUE, 13, 3
FROM public.users u WHERE u.email LIKE '%fullstack%@test.local';
```

### Test 4: Verify Data Isolation

```bash
#!/bin/bash
# test-data-isolation.sh

USER1_ID="backend-dev-id"
USER2_ID="frontend-dev-id"
USER3_ID="fullstack-dev-id"

echo "=== Testing Data Isolation ==="

# Test 1: User 1 gets all their applications
echo "✓ User 1 should see 2 applications (Google, Meta)"
curl "http://localhost:3000/api/applications?user_id=$USER1_ID"

# Test 2: User 1 should NOT see User 2's applications
echo "✓ User 1 should NOT see User 2's applications"
curl "http://localhost:3000/api/applications?user_id=$USER2_ID" \
  -H "Authorization: Bearer USER1_TOKEN"
# Expected: 403 Forbidden or empty result

# Test 3: Each user's learning tasks are isolated
echo "✓ Each user should only see their own learning tasks"
curl "http://localhost:3000/api/learning-tasks?user_id=$USER1_ID"
curl "http://localhost:3000/api/learning-tasks?user_id=$USER2_ID"
curl "http://localhost:3000/api/learning-tasks?user_id=$USER3_ID"

# Test 4: Check RLS is working
echo "✓ Running RLS verification query"
psql "$DATABASE_URL" -c "
  SELECT * FROM applications WHERE user_id != current_user_id();
  -- Should return: 0 rows
"
```

### Test 5: Agent Functionality - All Users

```bash
#!/bin/bash
# test-agents-multi-user.sh

CRON_SECRET="your-cron-secret"
USER_IDS=(
  "backend-user-id"
  "frontend-user-id"
  "fullstack-user-id"
)

echo "=== Testing All Agents with Multiple Users ==="

for user in "${USER_IDS[@]}"; do
  echo ""
  echo "Testing agents for user: $user"

  # 1. Learning Path Service
  echo "1. Learning Path Service..."
  curl -X POST "http://localhost:3000/api/cron/trigger-learning-paths?userId=$user" | jq .

  # 2. Job Market Analysis
  echo "2. Job Market Analysis..."
  curl -X POST "http://localhost:3000/api/cron/trigger-jobs?userId=$user" | jq .

  # 3. Tracker Agent (pipeline status)
  echo "3. Tracker Agent..."
  curl "http://localhost:3000/api/metrics?userId=$user" | jq .

  # Wait between users to respect rate limits
  sleep 5
done

echo ""
echo "✓ All agents tested for all users"
```

### Test 6: Concurrent Operations

```bash
#!/bin/bash
# test-concurrent.sh
# Simulates multiple users hitting API simultaneously

USERS=("user1" "user2" "user3" "user4" "user5")

echo "=== Testing Concurrent Operations ==="
echo "Launching 5 concurrent learning path requests..."

for user in "${USERS[@]}"; do
  (
    curl -X POST "http://localhost:3000/api/cron/trigger-learning-paths?userId=$user" \
      -w "\nStatus: %{http_code}\n" \
      -o "/dev/null"
  ) &
done

wait
echo "✓ All concurrent requests completed"

# Check for errors
echo ""
echo "Checking logs for errors:"
grep -i "error\|failed" /var/log/app.log | tail -20
```

### Test 7: Cost Tracking Across Users

```bash
#!/bin/bash
# test-cost-tracking.sh

echo "=== Testing Cost Tracking ==="

# Get cost report for each user
for user_id in "user1" "user2" "user3"; do
  echo ""
  echo "Cost report for $user_id (last 7 days):"
  curl "http://localhost:3000/api/metrics/cost?userId=$user_id&days=7" | jq '.'
done

# Check daily budget limits
echo ""
echo "Checking daily budget status:"
psql "$DATABASE_URL" -c "
  SELECT user_id, DATE(date) as date, total_cost
  FROM cost_tracking
  WHERE DATE(date) = CURRENT_DATE
  ORDER BY total_cost DESC;
"
```

### Test 8: Learning Plans for Multiple Users

```bash
#!/bin/bash
# test-learning-plans.sh

echo "=== Verifying Learning Plans Match Job Requirements ==="

# Backend user should get Backend-focused skills
echo "Backend user (User 1) - expect: System Design, Kubernetes, Java"
curl "http://localhost:3000/api/cron/trigger-learning-paths?userId=$BACKEND_USER_ID" \
  | jq '.recommendations[0].skillGaps[].skillName'

# Frontend user should get Frontend-focused skills
echo "Frontend user (User 2) - expect: React, TypeScript, Vue"
curl "http://localhost:3000/api/cron/trigger-learning-paths?userId=$FRONTEND_USER_ID" \
  | jq '.recommendations[0].skillGaps[].skillName'

# Fullstack user should get mix
echo "Fullstack user (User 3) - expect: Node.js, React, Docker"
curl "http://localhost:3000/api/cron/trigger-learning-paths?userId=$FULLSTACK_USER_ID" \
  | jq '.recommendations[0].skillGaps[].skillName'
```

---

## ✅ Verification Checklist

Before production deployment, confirm ALL pass:

### Data Isolation
- [ ] User 1 cannot see User 2's applications
- [ ] Each user's learning tasks are separate
- [ ] RLS policies active and working
- [ ] No cross-user data leaks in logs

### Agent Functionality
- [ ] Mail Agent fetches emails for all users
- [ ] Learning Path Service generates recommendations
- [ ] Job Market Agent finds opportunities per user
- [ ] Tracker updates application statuses correctly
- [ ] All agents complete without errors

### Performance
- [ ] Learning Path response < 1 second for 3 users
- [ ] 5 concurrent requests don't cause errors
- [ ] Database connection pool not exhausted
- [ ] No memory leaks after 1 hour of load

### Cost Protection
- [ ] Cost tracking incrementing correctly
- [ ] Daily budget alerts trigger at threshold
- [ ] Rate limiting prevents abuse
- [ ] Gmail API calls batched with backoff

### Security
- [ ] No API keys in logs
- [ ] All endpoints validate user authorization
- [ ] Rate limit headers present in responses
- [ ] CRON_SECRET required for all cron jobs

---

## 🚀 Production Load Test

Once all above tests PASS, run:

```bash
# 1. Load test (10 concurrent users, 100 requests each)
artillery quick --count 10 --num 100 http://localhost:3000/api/cron/trigger-learning-paths

# 2. Monitor resources
watch -n 1 'free -h; ps aux | grep node'

# 3. Check database connections
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"

# 4. Review cost tracking
psql "$DATABASE_URL" -c "SELECT SUM(total_cost) FROM cost_tracking WHERE DATE(date) = CURRENT_DATE;"
```

---

## 📊 Expected Results

### Successful Multi-User Test
```
✓ 3 test users created
✓ 6 applications distributed across users
✓ All agents process all users
✓ Learning plans match job requirements
✓ Zero cross-user data leaks
✓ Cost tracking < $2 for test run
✓ Rate limiting working (no 429 errors)
✓ Concurrent requests handled
```

### Failed Indicators ⚠️
- One user sees another's data
- Agents timeout or 500 errors
- Cost > $5 for small test
- RLS policies not active
- Rate limiting allowing abuse
- Hardcoded user IDs in responses

---

## 🔧 Debugging Multi-User Issues

### Query to debug data isolation
```sql
-- Check if RLS is enabled
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check row count per user
SELECT user_id, COUNT(*) as app_count FROM applications GROUP BY user_id;

-- Verify all applications have user_id
SELECT COUNT(*) FROM applications WHERE user_id IS NULL;
```

### Check agent logs
```bash
# Tail logs filtering by user
tail -f logs/app.log | grep "user1"

# Count errors by user
grep "ERROR" logs/app.log | cut -d'|' -f2 | sort | uniq -c
```

---

**Status**: Use this guide to verify production readiness
**Last Updated**: 2026-03-26
