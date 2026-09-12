# Module 23 Phase 3: Staging Deployment Checklist
## Complete Pre-Production Verification Procedures

**Date**: August 20, 2026  
**Environment**: Staging (Pre-Production)  
**Duration**: 24-48 hours recommended  

---

## 📋 PRE-DEPLOYMENT PHASE (Before Pushing Code)

### Environment Setup
- [ ] Staging Supabase project configured
- [ ] Staging environment variables set:
  - [ ] SUPABASE_URL (staging)
  - [ ] SUPABASE_SERVICE_ROLE_KEY (staging)
  - [ ] TELEGRAM_BOT_TOKEN (staging bot)
  - [ ] TELEGRAM_CHAT_ID (staging chat ID)
  - [ ] SLACK_WEBHOOK_URL (if applicable)

### Database Migration
- [ ] Run all migration scripts:
  - [ ] `agent_tasks` table created
  - [ ] `agent_memory` table created
  - [ ] `agent_decisions` table created
  - [ ] `agent_config` table created
  - [ ] `agent_notifications` table created
- [ ] All RPC functions created:
  - [ ] `has_role()`
  - [ ] `upsert_agent_learning()`
  - [ ] `generate_report()`
  - [ ] `send_email()`
  - [ ] `cleanup_expired_memory()`
- [ ] All indexes created
- [ ] RLS policies enabled
- [ ] Agent config initialized (CHRO)

### Code Preparation
- [ ] All apply-flow files copied to staging:
  - [ ] apply-flow-types.ts
  - [ ] apply-flow-core.ts
  - [ ] apply-flow-execute.ts
  - [ ] apply-flow-memory.ts
  - [ ] apply-flow-notify.ts
- [ ] Telegram webhook handler copied:
  - [ ] apply-flow-telegram-webhook.ts
- [ ] Test suite included:
  - [ ] apply-flow.test.ts
- [ ] All files compiled successfully:
  ```bash
  npx tsc --noEmit supabase/functions/_shared/apply-flow-*.ts
  # Expected: Zero errors
  ```

### Local Testing
- [ ] Run full test suite locally:
  ```bash
  npm run test apply-flow
  # Expected: 50+ tests PASS
  ```
- [ ] No TypeScript errors:
  ```bash
  npx tsc --strict supabase/functions/_shared/apply-flow-*.ts
  # Expected: Zero errors
  ```
- [ ] No lint errors:
  ```bash
  npx eslint supabase/functions/_shared/apply-flow-*.ts
  # Expected: Zero errors
  ```

---

## 🚀 STAGING DEPLOYMENT PHASE

### Deployment Steps

**Step 1: Create Feature Branch**
```bash
git checkout -b staging/module-23-phase-3-deployment
```
- [ ] Feature branch created

**Step 2: Commit Changes**
```bash
git add supabase/functions/_shared/apply-flow-*.ts
git add supabase/functions/telegram-webhook-handler/index.ts
git commit -m "Module 23 Phase 3: Staging deployment

- Apply flow implementation (5 files, 2,100 LOC)
- Telegram webhook handler
- 50+ comprehensive tests (100% pass)
- Database migration scripts
- Integration examples
- Deployment procedures

Test results: 50/50 PASS ✅
Type safety: 100%
Security: Enterprise-grade"

# Expected: Commit successful
```
- [ ] Changes committed

**Step 3: Push to Staging**
```bash
git push origin staging/module-23-phase-3-deployment
# Expected: Push successful
```
- [ ] Code pushed to staging branch

**Step 4: Monitor Deployment**
```bash
# Watch Hostinger deployment logs
# Expected: Auto-deploy starts within 2-3 minutes
```
- [ ] Staging deployment triggered

**Step 5: Verify Edge Functions Deployed**
```bash
supabase functions list --project-ref staging
# Expected output includes:
# - chro-orchestrator
# - telegram-webhook-handler
# - Plus all other functions
```
- [ ] Both functions listed and active

---

## ✅ POST-DEPLOYMENT VERIFICATION (Phase 1: Infrastructure)

### Database Connectivity
```sql
-- Test connection and table access
SELECT COUNT(*) as task_count FROM agent_tasks;
SELECT COUNT(*) as memory_count FROM agent_memory WHERE agent_id = 'CHRO';
SELECT COUNT(*) as decision_count FROM agent_decisions;

-- Expected: All queries return results (0 is OK for empty tables)
```
- [ ] Database tables accessible
- [ ] No connection errors

### RPC Function Access
```sql
-- Test each RPC function
SELECT has_role('00000000-0000-0000-0000-000000000001'::uuid, 'admin');
-- Expected: TRUE or FALSE (not error)

SELECT upsert_agent_learning('CHRO', 'test', 'approve', true, '{}');
-- Expected: Returns UUID or NULL (not error)

SELECT generate_report('daily', 7);
-- Expected: Returns JSON object (not error)

SELECT send_email('test@example.com', 'Test', 'Message');
-- Expected: Returns TRUE (not error)

SELECT cleanup_expired_memory();
-- Expected: Returns integer (not error)
```
- [ ] All RPC functions callable
- [ ] No SQL errors
- [ ] Functions return expected types

### Environment Variables
```bash
# Verify staging environment variables set
echo $TELEGRAM_BOT_TOKEN | head -c 20
# Expected: Non-empty value

echo $TELEGRAM_CHAT_ID | head -c 10
# Expected: Non-empty value
```
- [ ] All env vars configured in Hostinger
- [ ] Telegram bot token valid
- [ ] Chat ID configured

---

## ✅ POST-DEPLOYMENT VERIFICATION (Phase 2: Functionality)

### Test 1: Basic Intake Workflow

**Request**:
```bash
curl -X POST https://staging.example.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Create test coupon STAG001 with $5 discount",
    "source": "ceo",
    "priority": 3
  }'
```

**Expected Response**:
```json
{
  "status": "complete",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "decision": "approve",
  "result": {
    "coupon_id": "coup_stag001",
    "code": "STAG001"
  },
  "execution_time_ms": 234,
  "memory_updated": true
}
```

**Verification**:
- [ ] Response received (HTTP 200)
- [ ] Task ID generated
- [ ] Status is "complete"
- [ ] Result contains coupon data
- [ ] Execution time recorded

**Database Check**:
```sql
SELECT id, task_type, status, result 
FROM agent_tasks 
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```
- [ ] Task record created in database
- [ ] Task status is "completed"
- [ ] Result stored correctly

### Test 2: Escalation Workflow

**Request** (sensitive task):
```bash
curl -X POST https://staging.example.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer $STAGING_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Change price of product LAPTOP001 to $899.99",
    "source": "agent",
    "priority": 4,
    "user_id": "agent-user-id"
  }'
```

**Expected Response**:
```json
{
  "status": "pending_approval",
  "task_id": "550e8400-e29b-41d4-a716-446655440001",
  "decision": "escalate",
  "requires_approval": true,
  "next_action": "Awaiting CEO approval..."
}
```

**Verification**:
- [ ] Response received (HTTP 200)
- [ ] Status is "pending_approval"
- [ ] Decision is "escalate"
- [ ] Task ID provided

**Telegram Check**:
- [ ] CEO receives Telegram message
- [ ] Message contains task details
- [ ] Inline buttons present ("Apply koro", "Deny")
- [ ] Button data includes task ID

**Database Check**:
```sql
SELECT id, status, created_at 
FROM agent_tasks 
WHERE status = 'pending_approval'
AND created_at > now() - interval '5 minutes';
```
- [ ] Task status is "pending_approval"
- [ ] Task record exists

### Test 3: CEO Approval Flow

**Simulate Button Click**:
```bash
curl -X POST https://staging.example.supabase.co/functions/v1/telegram-webhook-handler \
  -H "Content-Type: application/json" \
  -d '{
    "callback_query": {
      "id": "query-12345",
      "from": {"id": 123456789},
      "data": "apply_550e8400-e29b-41d4-a716-446655440001"
    }
  }'
```

**Expected Result**:
- [ ] Task status updates to "completed" (or "executing" then "completed")
- [ ] Task executes successfully
- [ ] CEO receives completion notification

**Telegram Check**:
- [ ] Completion message received
- [ ] Message includes success indicator (✅)
- [ ] Includes execution time

**Database Check**:
```sql
SELECT status, completed_at, result 
FROM agent_tasks 
WHERE id = '550e8400-e29b-41d4-a716-446655440001';
```
- [ ] Status is "completed"
- [ ] Completed timestamp recorded
- [ ] Result contains execution data

### Test 4: Memory Persistence

**Check**:
```sql
SELECT context_type, content 
FROM agent_memory 
WHERE agent_id = 'CHRO'
AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**Verification**:
- [ ] Memory records created after task execution
- [ ] Context type includes "learning"
- [ ] Content includes task details
- [ ] At least one decision record per task

### Test 5: Error Handling

**Test Invalid Input**:
```bash
curl -X POST https://staging.example.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Create coupon with INVALID_CODE$ format",
    "source": "ceo"
  }'
```

**Expected**:
- [ ] Validation error returned
- [ ] HTTP 400 or 422 status
- [ ] Error message describes issue
- [ ] Task marked as failed (not executed)

**Test Unauthorized Access**:
```bash
curl -X POST https://staging.example.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directive":"test","source":"ceo"}'
```

**Expected**:
- [ ] HTTP 401 Unauthorized
- [ ] Clear error message
- [ ] No task created

### Test 6: Load Testing

**Concurrent Requests** (5 parallel):
```bash
for i in {1..5}; do
  curl -X POST https://staging.example.supabase.co/functions/v1/chro-orchestrator \
    -H "Authorization: Bearer $STAGING_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"directive\":\"Test task $i\",\"source\":\"ceo\"}" &
done
wait
```

**Verification**:
- [ ] All 5 requests complete
- [ ] No timeouts
- [ ] All responses valid JSON
- [ ] All tasks created in database
- [ ] No duplicate IDs

### Test 7: Rate Limiting

**Auto-Execute Rate Limit** (100 req/min):
```bash
# Make 101 rapid requests to auto-execute task
for i in {1..101}; do
  curl -X POST https://staging.example.supabase.co/functions/v1/chro-orchestrator \
    -H "Authorization: Bearer $STAGING_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"directive\":\"Task $i\",\"source\":\"ceo\"}" &
  
  # Stop if we get rate limit response
  if [ $(($i % 20)) -eq 0 ]; then
    sleep 0.1
  fi
done
```

**Verification**:
- [ ] First 100 requests succeed
- [ ] Request 101+ returns rate limit error (HTTP 429)
- [ ] Error message explains rate limit

### Test 8: Notification Channels

**Verify Telegram**:
- [ ] Check Telegram chat for bot messages
- [ ] Verify HTML formatting
- [ ] Confirm inline buttons work
- [ ] Completion messages received

**Verify Slack** (if configured):
```bash
# Check Slack channel for bot messages
# Expected: Rich formatted messages with task details
```
- [ ] Task notifications appear
- [ ] Format matches expected structure
- [ ] Emoji/formatting displays correctly

**Verify Webhook** (if configured):
- [ ] Check webhook receiver logs
- [ ] Verify JSON payload structure
- [ ] Confirm all required fields present

### Test 9: Audit Trail

**Check Decision Log**:
```sql
SELECT task_id, decision_type, created_at 
FROM agent_decisions 
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**Verification**:
- [ ] Decision recorded for each task
- [ ] Decision type matches action (approve, escalate, etc.)
- [ ] Timestamp accurate
- [ ] Task ID references correct task

**Check Notification Log**:
```sql
SELECT task_id, channel, delivery_status, created_at 
FROM agent_notifications 
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

- [ ] Notification record for each event
- [ ] Channel correct (telegram, slack, webhook)
- [ ] Delivery status recorded

### Test 10: Performance Metrics

**Check Execution Times**:
```sql
SELECT 
  task_type,
  COUNT(*) as total,
  AVG(execution_time_ms) as avg_ms,
  MAX(execution_time_ms) as max_ms,
  MIN(execution_time_ms) as min_ms
FROM agent_tasks
WHERE created_at > now() - interval '1 hour'
  AND status = 'completed'
GROUP BY task_type;
```

**Verification**:
- [ ] Average execution time < 500ms
- [ ] Max execution time < 2000ms
- [ ] No timeouts or hung processes

---

## 📊 MONITORING DURING STAGING

### Real-Time Monitoring

**Function Logs**:
```bash
supabase functions logs chro-orchestrator --tail
supabase functions logs telegram-webhook-handler --tail
```
- [ ] Watch logs in real-time
- [ ] Note any errors or warnings
- [ ] Verify task execution logs appear

**Database Monitoring**:
```bash
# Watch for growing tables
SELECT 'agent_tasks' as table_name, COUNT(*) FROM agent_tasks
UNION ALL
SELECT 'agent_decisions', COUNT(*) FROM agent_decisions
UNION ALL
SELECT 'agent_memory', COUNT(*) FROM agent_memory;
```
- [ ] Tables growing as expected
- [ ] No rapid growth indicating errors
- [ ] Memory table receives records

### Log Analysis

**Error Rate**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) as error_percentage
FROM agent_tasks
WHERE created_at > now() - interval '1 hour';
```

**Expected**: Error percentage < 1%
- [ ] Low error rate
- [ ] Most tasks complete successfully

---

## 🧪 AUTOMATED TEST SUITE

**Run Full Test Suite Against Staging**:
```bash
npm run test:staging apply-flow

# Expected output:
# ✅ Unit Tests: 35/35 PASS
# ✅ Integration Tests: 10/10 PASS
# ✅ E2E Tests: 5/5 PASS
# ✅ Total: 50/50 PASS
```

- [ ] All 50+ tests pass against staging
- [ ] No test failures
- [ ] No timeouts

---

## 📋 SMOKE TEST CHECKLIST (24-48 Hours)

Run these tests throughout the staging period:

**Hour 1-4 (Initial)**:
- [ ] Test 1: Basic intake workflow
- [ ] Test 2: Escalation workflow
- [ ] Test 3: CEO approval flow
- [ ] Test 4: Memory persistence
- [ ] Test 5: Error handling

**Hour 4-12 (Extended)**:
- [ ] Test 6: Load testing (5 concurrent)
- [ ] Test 7: Rate limiting
- [ ] Test 8: Notification channels
- [ ] Test 9: Audit trail
- [ ] Test 10: Performance metrics

**Hour 12-24 (Overnight)**:
- [ ] Monitor logs for errors
- [ ] Check database growth
- [ ] Verify no memory leaks
- [ ] Confirm no connection issues
- [ ] Review error logs

**Hour 24-48 (Final Validation)**:
- [ ] Repeat all 10 tests
- [ ] Run performance benchmarks
- [ ] Analyze decision patterns
- [ ] Verify all metrics stable
- [ ] Sign off on readiness

---

## 🚨 ROLLBACK CRITERIA

Rollback to previous version if:

- [ ] ❌ Error rate exceeds 5%
- [ ] ❌ Memory usage exceeds 1GB
- [ ] ❌ Average execution time > 2 seconds
- [ ] ❌ Database connection failures
- [ ] ❌ Telegram notifications not delivering
- [ ] ❌ Critical security issue found
- [ ] ❌ RLS policy bypassed
- [ ] ❌ Data corruption detected
- [ ] ❌ Function timeout issues

**Rollback Process**:
```bash
git revert HEAD
git push origin staging/module-23-phase-3-deployment
# Hostinger auto-redeploys (2-3 minutes)
```

---

## ✅ SIGN-OFF CHECKLIST

After completing all verification:

**Technical Sign-Off**:
- [ ] All tests passing (50/50)
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] Security audit passed
- [ ] Database integrity verified

**Operational Sign-Off**:
- [ ] Documentation complete
- [ ] Team trained on system
- [ ] Monitoring alerts configured
- [ ] Rollback procedure verified
- [ ] On-call support assigned

**CEO Sign-Off**:
- [ ] Reviewed test results
- [ ] Approved for production
- [ ] Telegram notifications working
- [ ] Performance acceptable

---

## 📝 STAGING SIGN-OFF FORM

```
Module 23 Phase 3: Staging Deployment Sign-Off

Date: _______________
Time: _______________

Infrastructure Status:
  Database Migration: ☐ PASS  ☐ FAIL
  RPC Functions: ☐ PASS  ☐ FAIL
  Edge Functions: ☐ PASS  ☐ FAIL

Functionality Testing:
  Intake Workflow: ☐ PASS  ☐ FAIL
  Escalation Workflow: ☐ PASS  ☐ FAIL
  Approval Flow: ☐ PASS  ☐ FAIL
  Memory Persistence: ☐ PASS  ☐ FAIL
  Error Handling: ☐ PASS  ☐ FAIL

Load & Performance:
  Load Test (5 concurrent): ☐ PASS  ☐ FAIL
  Rate Limiting: ☐ PASS  ☐ FAIL
  Performance Metrics: ☐ PASS  ☐ FAIL

Monitoring:
  Telegram Notifications: ☐ WORKING  ☐ ISSUE
  Slack Integration: ☐ WORKING  ☐ ISSUE / ☐ N/A
  Function Logs: ☐ CLEAN  ☐ WARNINGS  ☐ ERRORS
  Database Growth: ☐ NORMAL  ☐ EXCESSIVE

Test Results:
  Unit Tests: ___/35 PASS
  Integration Tests: ___/10 PASS
  E2E Tests: ___/5 PASS
  Overall: ___/50 PASS (Expected: 50/50)

Issues Found:
  [ ] None (Ready for production)
  [ ] Minor (Document and monitor)
  [ ] Major (Requires fixes before production)

Details: ________________________________________________

Signed By: _________________________ Date: _______________
Approved By (CEO): _________________ Date: _______________

Status: ☐ APPROVED FOR PRODUCTION  ☐ HOLD  ☐ NEEDS FIXES
```

---

**Status**: ✅ STAGING DEPLOYMENT CHECKLIST COMPLETE

Ready to begin 24-48 hour staging verification period.

After successful staging validation → Production Deployment (Module 23 Phase 4)

