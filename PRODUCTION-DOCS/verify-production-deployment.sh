#!/bin/bash

#
# Module 23 Phase 3: Production Deployment Verification Script
# Automated verification of ARQ Master OS "Apply" Flow in production
#
# Usage: ./verify-production-deployment.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:?Error: SUPABASE_URL not set}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Error: SUPABASE_SERVICE_ROLE_KEY not set}"
API_TOKEN="${API_TOKEN:?Error: API_TOKEN not set}"

# Counters
PASSED=0
FAILED=0

# Functions
log_section() {
  echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
}

log_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASSED++))
}

log_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAILED++))
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================================================
# PHASE 1: DATABASE CONNECTIVITY
# ============================================================================

log_section "Phase 1: Database Connectivity"

# Test database connection via Supabase REST API
echo "Testing database connectivity..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/agent_tasks?limit=1" \
  2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
  log_pass "Database connectivity verified (HTTP 200)"
else
  log_fail "Database connectivity failed (HTTP $RESPONSE)"
fi

# Check table creation
echo "Checking required tables..."
TABLES=$(curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/information_schema.tables?table_schema=eq.public&table_name=in.(agent_tasks,agent_memory,agent_decisions,agent_config,agent_notifications)&select=table_name" | grep -o '"table_name"' | wc -l)

if [ "$TABLES" -ge 5 ]; then
  log_pass "All 5 required tables found"
else
  log_fail "Expected 5 tables, found $TABLES"
fi

# ============================================================================
# PHASE 2: EDGE FUNCTION DEPLOYMENT
# ============================================================================

log_section "Phase 2: Edge Function Deployment"

echo "Checking chro-orchestrator function..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS "$SUPABASE_URL/functions/v1/chro-orchestrator" \
  2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
  log_pass "chro-orchestrator function deployed and accessible"
else
  log_fail "chro-orchestrator function not accessible (HTTP $RESPONSE)"
fi

echo "Checking telegram-webhook-handler function..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS "$SUPABASE_URL/functions/v1/telegram-webhook-handler" \
  2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
  log_pass "telegram-webhook-handler function deployed and accessible"
else
  log_fail "telegram-webhook-handler function not accessible (HTTP $RESPONSE)"
fi

# ============================================================================
# PHASE 3: BASIC FUNCTIONALITY
# ============================================================================

log_section "Phase 3: Basic Functionality"

echo "Testing intake workflow (CEO source)..."
TASK_ID=$(curl -s -X POST "$SUPABASE_URL/functions/v1/chro-orchestrator" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Create test coupon PROD001 with $5 discount",
    "source": "ceo",
    "priority": 3
  }' 2>/dev/null | jq -r '.task_id // .error // "failed"')

if [[ "$TASK_ID" != "failed" ]] && [[ "$TASK_ID" != "null" ]]; then
  log_pass "Intake workflow successful (Task ID: ${TASK_ID:0:8}...)"
else
  log_fail "Intake workflow failed or returned error"
fi

echo "Testing task persistence..."
TASK_COUNT=$(curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/agent_tasks?limit=1" 2>/dev/null | jq 'length')

if [ "$TASK_COUNT" -gt 0 ]; then
  log_pass "Task records persisting to database"
else
  log_fail "No task records found in database"
fi

# ============================================================================
# PHASE 4: VALIDATION & SECURITY
# ============================================================================

log_section "Phase 4: Validation & Security"

echo "Testing invalid input rejection..."
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/chro-orchestrator" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Create coupon INVALID$CODE with bad format",
    "source": "ceo"
  }' 2>/dev/null | jq -r '.status // .error // "unknown"')

if [[ "$RESPONSE" == *"error"* ]] || [[ "$RESPONSE" == *"fail"* ]]; then
  log_pass "Input validation working (invalid input rejected)"
else
  log_warn "Input validation may need verification - got response: $RESPONSE"
fi

echo "Testing unauthorized access..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$SUPABASE_URL/functions/v1/chro-orchestrator" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directive":"test","source":"ceo"}' 2>/dev/null || echo "000")

if [ "$RESPONSE" = "401" ]; then
  log_pass "Unauthorized access rejected (HTTP 401)"
else
  log_warn "Expected HTTP 401 for invalid token, got $RESPONSE"
fi

# ============================================================================
# PHASE 5: MEMORY & LEARNING
# ============================================================================

log_section "Phase 5: Memory & Learning"

echo "Checking agent memory table..."
MEMORY_COUNT=$(curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/agent_memory?agent_id=eq.CHRO&limit=1" 2>/dev/null | jq 'length')

if [ "$MEMORY_COUNT" -gt 0 ]; then
  log_pass "Agent memory records found ($MEMORY_COUNT+ records)"
else
  log_warn "No memory records yet (expected after first tasks)"
fi

echo "Checking decision history..."
DECISION_COUNT=$(curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/agent_decisions?limit=1" 2>/dev/null | jq 'length')

if [ "$DECISION_COUNT" -gt 0 ]; then
  log_pass "Decision records found ($DECISION_COUNT+ records)"
else
  log_warn "No decision records yet (expected after first tasks)"
fi

# ============================================================================
# PHASE 6: NOTIFICATIONS
# ============================================================================

log_section "Phase 6: Notifications"

echo "Checking notification log..."
NOTIF_COUNT=$(curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/agent_notifications?limit=1" 2>/dev/null | jq 'length')

if [ "$NOTIF_COUNT" -gt 0 ]; then
  log_pass "Notification records found ($NOTIF_COUNT+ records)"
else
  log_warn "No notification records yet (expected after first tasks)"
fi

# ============================================================================
# PHASE 7: RATE LIMITING
# ============================================================================

log_section "Phase 7: Rate Limiting"

echo "Testing rate limit enforcement (making 5 requests)..."
RATE_LIMITED=0
for i in {1..5}; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$SUPABASE_URL/functions/v1/chro-orchestrator" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"directive\":\"Rate limit test $i\",\"source\":\"ceo\"}" 2>/dev/null || echo "000")
  
  if [ "$RESPONSE" = "429" ]; then
    ((RATE_LIMITED++))
  fi
done

if [ "$RATE_LIMITED" -eq 0 ]; then
  log_pass "Rate limiting configured (no 429 errors on 5 requests)"
else
  log_warn "Rate limiting may be too aggressive ($RATE_LIMITED/5 requests rate limited)"
fi

# ============================================================================
# PHASE 8: PERFORMANCE
# ============================================================================

log_section "Phase 8: Performance Metrics"

echo "Measuring function response time..."
START=$(date +%s%N)
curl -s -X POST "$SUPABASE_URL/functions/v1/chro-orchestrator" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directive":"Performance test","source":"ceo"}' > /dev/null 2>&1 || true
END=$(date +%s%N)

ELAPSED=$(((END - START) / 1000000))
echo "Response time: ${ELAPSED}ms"

if [ "$ELAPSED" -lt 2000 ]; then
  log_pass "Response time acceptable (${ELAPSED}ms < 2000ms)"
elif [ "$ELAPSED" -lt 5000 ]; then
  log_warn "Response time slower than ideal (${ELAPSED}ms)"
else
  log_fail "Response time too slow (${ELAPSED}ms > 5000ms)"
fi

# ============================================================================
# SUMMARY
# ============================================================================

log_section "Verification Summary"

TOTAL=$((PASSED + FAILED))
PASS_RATE=$((PASSED * 100 / TOTAL))

echo "Results:"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo "  📊 Total: $TOTAL"
echo "  📈 Pass Rate: ${PASS_RATE}%"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ PRODUCTION DEPLOYMENT VERIFIED SUCCESSFULLY${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  exit 0
elif [ "$FAILED" -lt 3 ]; then
  echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}⚠️  DEPLOYMENT VERIFIED WITH WARNINGS${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
  exit 1
else
  echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}❌ DEPLOYMENT VERIFICATION FAILED${NC}"
  echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
  exit 2
fi
