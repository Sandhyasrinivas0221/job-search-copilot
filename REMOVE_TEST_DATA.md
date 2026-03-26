# 🧹 REMOVE TEST DATA - Code Fixes for Production

**Files to fix**: 6 dashboard + 1 OAuth file
**Time**: ~20 minutes

---

## 1️⃣ Fix Hardcoded Test UUIDs (5 Dashboard Files)

### Files:
- src/app/dashboard/applications/page.tsx (line 29)
- src/app/dashboard/learning/page.tsx
- src/app/dashboard/metrics/page.tsx
- src/app/dashboard/pipeline/page.tsx
- src/app/dashboard/suggestions/page.tsx

### BEFORE (With Test Data):
```typescript
// Fallback to test user for development
const userId = user?.id || "00000000-0000-0000-0000-000000000001"
```

### AFTER (Production):
```typescript
if (!user) {
  return (
    <div className="p-6">
      <p>Please <Link href="/auth/login">log in</Link> to view your page</p>
    </div>
  )
}
const userId = user.id
```

---

## 2️⃣ Fix OAuth Fallback

### File: src/app/api/auth/google/callback/route.ts (lines 43-50)

### BEFORE:
```typescript
if (!state) {
  // For testing without state, use a default test UUID
  console.warn("[oauth-callback] No state parameter provided...")
  return NextResponse.redirect(...)
}
```

### AFTER:
```typescript
if (!state) {
  // Production: Always require state parameter
  console.error("[oauth-callback] OAuth state missing - rejected")
  return NextResponse.redirect(...)
}
```

---

## 3️⃣ Fix Cron Auth Check

### File: src/app/api/cron/mail-listener/route.ts (line 25)

### BEFORE:
```typescript
// Skip auth check in development for manual testing
if (process.env.NODE_ENV === "production") {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

### AFTER:
```typescript
// Always require CRON_SECRET
const authHeader = request.headers.get("authorization")
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

---

## Verification

```bash
# Verify all test data removed
grep -r "00000000-0000-0000-0000-000000000001" src/
# Should return: 0 results

grep -r "For testing\|Skip auth" src/
# Should return: 0 results
```

---

See FREE_TIER_MASTER_CHECKLIST.md for next steps!
