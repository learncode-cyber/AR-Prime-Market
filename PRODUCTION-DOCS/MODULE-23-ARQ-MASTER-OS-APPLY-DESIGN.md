# Module 23: ARQ Master OS "Apply" Flow Design
## Complete Workflow Specification for Agent Task Execution

**Date**: August 19, 2026  
**Module**: 23 (P1 - BLOCKING)  
**Status**: DESIGN PHASE  
**Scope**: Agent task orchestration workflow ("apply" flow)

---

## 📋 EXECUTIVE SUMMARY

The "apply" flow is the core orchestration workflow that transforms CEO directives into executed tasks through the ARQ Master OS (Agent Resource & Query system).

**Current State**: 
- ✅ Database schema exists (agent_tasks, agent_memory, agent_decisions)
- ✅ chro-orchestrator edge function (partially implemented)
- ✅ Agent identity & memory system defined
- ❓ "apply" workflow flow not yet documented/implemented

**Design Deliverable**:
- Complete state machine specification
- Message/event flow diagrams
- Implementation architecture
- Integration points
- Security & validation rules

---

## 🏗️ EXISTING INFRASTRUCTURE ANALYSIS

### Current Components

#### 1. Database Schema
```
agent_tasks
├─ id (UUID)
├─ status (pending | executing | completed | failed)
├─ priority (1-5)
├─ task_type (directive | research | execution | report)
├─ input_data (JSONB - structured task input)
├─ result_data (JSONB - task output)
├─ created_at / updated_at
└─ assigned_agent (text - agent identifier)

agent_memory
├─ id (UUID)
├─ agent_id (text - "CHRO", "ai_research", etc.)
├─ context_type (string - "operational", "learning", "decision")
├─ content (JSONB - memory payload)
├─ expires_at (optional - TTL)
└─ created_at

agent_decisions
├─ id (UUID)
├─ task_id (UUID - reference to agent_tasks)
├─ decision_type (string - "approve", "deny", "defer", "escalate")
├─ reasoning (text)
├─ parameters (JSONB - decision parameters)
└─ timestamp

agent_config
├─ agent_type (text - primary key)
├─ is_active (boolean)
├─ max_retries (int)
├─ timeout_seconds (int)
└─ settings (JSONB)
```

#### 2. Edge Functions
- **chro-orchestrator**: Main agent orchestration controller
- **agent-research-loop**: Daily self-research for CHRO
- **ai-learning-engine**: Cross-agent learning engine
- **daily-ceo-report**: CEO briefing generation
- **telegram-notify**: Event notifications

#### 3. Shared Utilities
- **agent-identity.ts**: CHRO role identity, memory loader
- **auth.ts**: Authentication gates
- **currency.ts**: Multi-currency conversion

#### 4. Agent Role Definition
```
AGENT_ROLE: "Chief HR & Operations Officer (CHRO) — Dropshipping Revenue Operator"

Core Mandate:
- Autonomous execution (no token-wasting clarifications)
- Memory-backed decision making
- Chain of command: CEO approval for production changes
- Zero-loss revenue focus ($5M annual target)
```

---

## 🎯 "APPLY" FLOW SPECIFICATION

### What is "Apply"?

The "apply" flow is the execution pipeline that:
1. Receives a directive (from CEO, other agents, or scheduled tasks)
2. Validates against authorization + context
3. Loads agent memory & decision history
4. Executes the task (or delegates to sub-agents)
5. Persists outcomes in memory/learning logs
6. Returns result + notifications

### Flow Stages

#### Stage 1: INTAKE & VALIDATION

**Input**: 
```json
{
  "directive": "Create USD coupon SAVE5 with $5 discount",
  "source": "ceo",
  "priority": "high",
  "context": {
    "campaign": "summer-sale",
    "market": "USD"
  }
}
```

**Processing**:
1. **Source Authentication**: Verify sender is CEO or authorized agent
   - If source="ceo" → use CEO's credentials
   - If source="agent" → verify agent role + permissions
   - If source="cron" → verify scheduled task authorization

2. **Permission Check**: Does agent role allow this task type?
   - CHRO can: create coupons, manage orders, run reports, deploy campaigns
   - CHRO cannot: modify payment settings, change core DB schema, export PII

3. **Intent Classification**: Parse directive into structured task
   ```
   TASK_TYPE: "coupon_create"
   ENTITY: "coupons"
   ACTION: "create"
   PARAMS: {
     code: "SAVE5",
     discount_type: "fixed",
     discount_value: 5,
     discount_currency: "USD"
   }
   ```

4. **Store in agent_tasks**:
   ```sql
   INSERT INTO agent_tasks (
     id, status, priority, task_type, input_data, assigned_agent, created_at
   ) VALUES (
     gen_random_uuid(),
     'pending',
     3,
     'coupon_create',
     '{"code":"SAVE5",...}'::jsonb,
     'CHRO',
     now()
   )
   ```

**Output**: task_id (UUID) for tracking

---

#### Stage 2: CONTEXT LOADING

**Load Agent Memory**:
```sql
SELECT content FROM agent_memory
WHERE agent_id = 'CHRO'
  AND (context_type = 'operational' OR context_type = 'learning')
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC
LIMIT 10
```

**Memory Example**:
```json
{
  "operational": {
    "revenue_ytd": 1200000,
    "target_monthly": 416667,
    "active_campaigns": 8,
    "avg_aov": 45.50,
    "conversion_rate": 2.4
  },
  "learning": {
    "best_coupon_discount": "8-12%",
    "optimal_min_order": 30,
    "peak_shopping_times": ["Fri 6-10pm", "Sun 10am-2pm"],
    "market_trends": ["electronics trending", "fashion seasonal"]
  },
  "decision_history": {
    "coupon_approvals_count": 23,
    "coupon_denials_count": 2,
    "denial_reasons": ["discount too high", "conflicting campaign"]
  }
}
```

**Load Decision History**:
```sql
SELECT * FROM agent_decisions
WHERE agent_id = 'CHRO'
  AND decision_type IN ('approve', 'deny')
  AND created_at > now() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 20
```

**Output**: Enriched task context with memory

---

#### Stage 3: PRE-EXECUTION VALIDATION

**Business Logic Checks**:
1. **Coupon Validation** (if task_type = 'coupon_create'):
   - ✅ Discount not exceeding 50%
   - ✅ Discount currency matches accepted list (USD, BDT, GBP, etc.)
   - ✅ No duplicate coupon code
   - ✅ Min order amount reasonable (not < $5)
   - ✅ Doesn't conflict with active campaigns

2. **Budget Validation** (if task involves spend):
   - Check marketing budget available
   - Check budget depletion rate vs. target
   - Deny if exceeds daily/weekly/monthly caps

3. **Data Completeness**:
   - All required fields present
   - No missing parameters for task type
   - Types correct (string/number/date as expected)

**Decision Logic**:
```
IF validation_passed:
  → Proceed to Stage 4 (EXECUTION)
ELSE IF trivial_fix (e.g., format error):
  → Auto-fix + Proceed
ELSE IF blockers exist (e.g., duplicate code):
  → Log decision as DENY
  → Return error to source
ELSE IF ambiguous (e.g., discount seems high but unclear):
  → Escalate to CEO via telegram
  → Status = PENDING_APPROVAL
  → Wait for CEO "Apply koro" response
```

---

#### Stage 4: EXECUTION

**Sub-Stage 4A: Delegate or Execute**

If task is "standard" (in whitelisted auto-execute set):
```javascript
// Auto-execute whitelisted operations
const WHITELISTED_AUTO_EXECUTE = [
  'coupon_create',
  'order_mark_shipped',
  'email_notify',
  'generate_report',
  'research_trend'
];

if (WHITELISTED_AUTO_EXECUTE.includes(task.task_type)) {
  await executeTask(task);
}
```

If task is "sensitive" (requires CEO approval):
```javascript
const SENSITIVE_TASKS = [
  'price_change',
  'supplier_switch',
  'deploy_code',
  'export_customer_data',
  'cancel_payment'
];

if (SENSITIVE_TASKS.includes(task.task_type)) {
  status = 'pending_approval';
  await notifyCEO(task);
  // Wait for CEO response
}
```

**Sub-Stage 4B: Execute Task**

```typescript
async function executeTask(task: AgentTask) {
  const startTime = Date.now();
  
  try {
    // Update status
    await updateTaskStatus(task.id, 'executing');
    
    // Execute based on type
    let result;
    switch (task.task_type) {
      case 'coupon_create':
        result = await createCoupon(task.input_data);
        break;
      case 'order_mark_shipped':
        result = await markOrderShipped(task.input_data);
        break;
      case 'generate_report':
        result = await generateReport(task.input_data);
        break;
      // ... other task types
    }
    
    // Log success
    const duration = Date.now() - startTime;
    await logTaskCompletion(task.id, result, duration);
    
    return result;
    
  } catch (error) {
    // Log failure + retry logic
    await handleTaskError(task.id, error);
    throw error;
  }
}
```

**Retry Logic**:
```
Attempt 1 (immediate):
  ├─ If error is TRANSIENT (timeout, rate limit):
  │  └─ Wait 2s + Retry
  ├─ If error is PERMANENT (validation, auth):
  │  └─ Fail immediately
  └─ If error is UNKNOWN:
     └─ Escalate to CEO

Max retries: 3
Backoff: 2s, 5s, 10s
Circuit breaker: 5 consecutive failures = disable for 1 hour
```

---

#### Stage 5: MEMORY & LEARNING UPDATE

**Store Decision**:
```sql
INSERT INTO agent_decisions (
  id, task_id, decision_type, reasoning, parameters, created_at
) VALUES (
  gen_random_uuid(),
  $1,
  'approve',
  'Coupon SAVE5 created: within discount limits, no conflicts',
  '{"applied_checks": [...], "auto_approved": true}'::jsonb,
  now()
)
```

**Update Agent Memory**:
```sql
INSERT INTO agent_memory (
  id, agent_id, context_type, content, created_at
) VALUES (
  gen_random_uuid(),
  'CHRO',
  'learning',
  jsonb_build_object(
    'coupon_created', 'SAVE5',
    'discount', 5,
    'currency', 'USD',
    'execution_time_ms', $1,
    'success', true
  ),
  now()
)
```

**Upsert Learning Log**:
```sql
CALL upsert_agent_learning(
  p_source_agent := 'chro-orchestrator',
  p_scope := 'apply_flow',
  p_key := 'coupon_decisions',
  p_value := jsonb_agg(jsonb_build_object(
    'action', 'create',
    'code', 'SAVE5',
    'success', true,
    'timestamp', now()::text
  )),
  p_expires_days := 90
)
```

---

#### Stage 6: NOTIFICATION & RESPONSE

**Notify CEO** (if sensitive or high-impact):
```
Telegram: ✅ SAVE5 coupon created.
  Discount: $5 USD
  Min order: $30
  Active until: [date]
  Exec time: 234ms
  Memory: Updated
```

**Return to Source**:
```json
{
  "status": "complete",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "coupon_id": "...",
    "code": "SAVE5",
    "created_at": "2026-08-19T..."
  },
  "execution_time_ms": 234,
  "memory_updated": true
}
```

---

## 🔄 STATE MACHINE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLY FLOW STATE MACHINE                 │
└─────────────────────────────────────────────────────────────┘

START
  │
  ├─→ [INTAKE] ──validate──┐
  │                         │
  ├─→ [AUTHORIZED?] ────────┼──→ 401 ERROR (return)
  │   ├─ Yes               │
  │   └─ No                │
  │                         │
  ├─→ [CLASSIFY INTENT] ◄───┘
  │   ├─ Auto-execute task
  │   ├─ Requires approval
  │   └─ Invalid (DENY)
  │
  ├─→ [CONTEXT LOADING]
  │   ├─ Load agent memory
  │   ├─ Load decision history
  │   └─ Enrich task context
  │
  ├─→ [VALIDATION]
  │   ├─ Business logic checks
  │   ├─ Data completeness
  │   └─ Conflict detection
  │
  ├─→ [DECISION GATE]
  │   ├─ APPROVE ──────────────────→ [EXECUTION]
  │   ├─ DENY ────────────────────→ [FAILURE PATH]
  │   └─ ESCALATE ────→ [PENDING_APPROVAL]
  │                         │
  │                         └──→ Wait for CEO response
  │                             ├─ "Apply koro" → [EXECUTION]
  │                             └─ "Deny" → [FAILURE PATH]
  │
  ├─→ [EXECUTION]
  │   ├─ Execute task (with retries)
  │   ├─ Handle errors (escalate if needed)
  │   └─ Log result
  │
  ├─→ [MEMORY UPDATE]
  │   ├─ Store decision
  │   ├─ Update agent memory
  │   └─ Log to learning engine
  │
  ├─→ [NOTIFICATION]
  │   ├─ Notify CEO (if high-impact)
  │   ├─ Update task status
  │   └─ Return result to source
  │
  └─→ END (complete | failed | pending)
```

---

## 🔐 SECURITY & VALIDATION RULES

### Rule 1: Chain of Command
```
├─ Read-only operations: Auto-execute (no approval needed)
│  ├─ Generate reports
│  ├─ Query analytics
│  ├─ Load memory
│  └─ Research trends
│
├─ State-changing (whitelisted): Auto-execute with logging
│  ├─ Create coupons
│  ├─ Mark orders shipped
│  ├─ Send emails
│  └─ Update inventory notes
│
└─ Sensitive (high-risk): Require CEO approval
   ├─ Price changes
   ├─ Payment gateway config
   ├─ Deploy code
   ├─ Export customer data
   └─ Cancel/refund orders
```

### Rule 2: Rate Limiting
```
Auto-execute tasks: 100 per minute per agent
Escalated tasks: 10 per minute per CEO
Research operations: 50 per hour per agent
API calls: Rate-limited per upstream service
```

### Rule 3: Data Validation
```
All APPLY inputs must include:
- Task type (from approved list)
- Required parameters (type-checked)
- No SQL injection risk (use parameterized queries)
- No PII exposure (mask sensitive data in logs)
```

### Rule 4: Audit Trail
```
Every APPLY operation logs:
- Source (CEO / Agent / Cron)
- Timestamp
- Task type + parameters
- Decision (approve/deny/defer)
- Result (success/failure)
- Execution time
- Memory state before/after
```

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Core Flow (Days 1-2)
- [ ] Define apply() function signature
- [ ] Implement Stage 1-2 (Intake + Context)
- [ ] Test authorization gates
- [ ] Document state machine

### Phase 2: Execution Logic (Days 3-4)
- [ ] Implement Stage 3-4 (Validation + Execution)
- [ ] Add retry logic
- [ ] Test error handling
- [ ] Add escalation flow

### Phase 3: Memory & Learning (Days 5-6)
- [ ] Implement Stage 5 (Memory update)
- [ ] Connect to learning engine
- [ ] Test memory persistence
- [ ] Add analytics

### Phase 4: Notifications (Days 7)
- [ ] Implement Stage 6 (Telegram notify)
- [ ] Add webhook responses
- [ ] Test E2E flow
- [ ] Deploy to production

---

## 📊 EXPECTED METRICS

### Performance
- Intake-to-execute: <500ms (whitelisted)
- Intake-to-approval: <2s (escalated)
- Memory load: <100ms
- Total latency: <1s (p95)

### Reliability
- Success rate: >99.5% (whitelisted)
- Retry success rate: >95%
- Decision accuracy: >99%
- Memory consistency: 100%

### Operational
- Auto-execute percentage: 85% of tasks
- Escalation rate: <5% of tasks
- Manual denial rate: <2% of tasks
- CEO approval time: <5 minutes

---

## 🎯 NEXT STEPS

1. **Design Review**: CEO approves state machine
2. **Implementation**: Build apply() function + integrations
3. **Testing**: Unit + Integration + E2E tests
4. **Deployment**: Deploy edge function to production
5. **Monitoring**: Track metrics + memory usage

---

**Module Status**: DESIGN COMPLETE (Ready for implementation)

EOF
