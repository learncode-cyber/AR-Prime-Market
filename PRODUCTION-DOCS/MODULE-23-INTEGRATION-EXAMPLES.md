# Module 23: Apply Flow Integration Examples & Usage Guide

## Table of Contents
1. [Direct API Usage](#direct-api-usage)
2. [From Edge Functions](#from-edge-functions)
3. [From React Components](#from-react-components)
4. [From Scheduled Tasks](#from-scheduled-tasks)
5. [CEO Approval Flow](#ceo-approval-flow)
6. [Testing & Debugging](#testing--debugging)

---

## Direct API Usage

### Example 1: Create Coupon (Auto-Execute)

**Request:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Create coupon SUMMER20 with 20% discount for orders over $50",
    "source": "ceo",
    "priority": 3
  }'
```

**Response:**
```json
{
  "status": "complete",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "decision": "approve",
  "result": {
    "coupon_id": "coup_123abc",
    "code": "SUMMER20",
    "created_at": "2026-08-20T10:15:30Z"
  },
  "execution_time_ms": 245,
  "memory_updated": true
}
```

### Example 2: Change Price (Requires CEO Approval)

**Request:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Change price of product LAPTOP001 to $899.99",
    "source": "agent",
    "priority": 4,
    "user_id": "agent-user-id"
  }'
```

**Response:**
```json
{
  "status": "pending_approval",
  "task_id": "550e8400-e29b-41d4-a716-446655440001",
  "decision": "escalate",
  "requires_approval": true,
  "next_action": "Awaiting CEO approval. Reply with 'Apply koro' to proceed.",
  "execution_time_ms": 0,
  "memory_updated": false
}
```

*(CEO receives Telegram message with inline buttons)*

### Example 3: Generate Report (Cron Task)

**Request:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer CRON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Generate daily revenue report",
    "source": "cron",
    "priority": 2
  }'
```

**Response:**
```json
{
  "status": "complete",
  "task_id": "550e8400-e29b-41d4-a716-446655440002",
  "decision": "approve",
  "result": {
    "report_type": "daily",
    "period": "24h",
    "generated_at": "2026-08-20T10:20:00Z",
    "revenue_total": 12500.50,
    "orders_count": 156
  },
  "execution_time_ms": 1234,
  "memory_updated": true
}
```

---

## From Edge Functions

### Example 1: Call Apply Flow from Custom Edge Function

**File: `supabase/functions/my-custom-function/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsfetch';
import { intakeDirective } from '../_shared/apply-flow-core.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

serve(async (req: Request) => {
  const { action } = await req.json();

  // Create a directive
  const directive = {
    directive: `${action} on product inventory`,
    source: 'agent' as const,
    priority: 3,
  };

  // Process through apply flow
  const { task, decision, error } = await intakeDirective(directive, supabase);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400 });
  }

  return new Response(JSON.stringify({
    task_id: task?.id,
    decision: decision?.decision,
    auto_executable: decision?.auto_executable,
  }));
});
```

### Example 2: Chain Multiple Tasks

```typescript
async function processMultipleTasks(tasks: string[]) {
  const results = [];

  for (const taskDescription of tasks) {
    const { task, decision } = await intakeDirective(
      {
        directive: taskDescription,
        source: 'cron',
        priority: 2,
      },
      supabase
    );

    if (task && decision?.proceed) {
      const validation = await validateTaskPreExecution(task, supabase);
      if (validation.valid) {
        const result = await executeTask(task, supabase);
        results.push({ task_id: task.id, success: result.success });
      }
    }
  }

  return results;
}
```

---

## From React Components

### Example 1: Create Coupon via Admin UI

**File: `src/client/components/admin/CouponCreator.tsx`**

```typescript
import { useMutation } from '@tanstack/react-query';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export function CouponCreator() {
  const supabase = useSupabaseClient();

  const createCoupon = useMutation(
    async (formData: any) => {
      // Build natural language directive
      const directive = `Create coupon ${formData.code} with ${formData.discount_value}% discount`;

      // Call chro-orchestrator
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chro-orchestrator`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await getToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            directive,
            source: 'api',
            priority: 3,
          }),
        }
      );

      const result = await response.json();

      if (result.status === 'complete') {
        return { success: true, coupon_id: result.result.coupon_id };
      } else if (result.status === 'pending_approval') {
        return { pending: true, task_id: result.task_id };
      } else {
        throw new Error(result.error?.message || 'Failed to create coupon');
      }
    },
    {
      onSuccess: (data) => {
        if (data.success) {
          toast.success('Coupon created!');
        } else if (data.pending) {
          toast.info('Awaiting CEO approval...');
        }
      },
    }
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      createCoupon.mutate({
        code: formData.get('code'),
        discount_value: formData.get('discount'),
      });
    }}>
      <input name="code" placeholder="Coupon code" />
      <input name="discount" type="number" placeholder="Discount %" />
      <button type="submit">
        {createCoupon.isLoading ? 'Creating...' : 'Create Coupon'}
      </button>
    </form>
  );
}
```

### Example 2: Monitor Task Status

```typescript
export function TaskMonitor({ taskId }: { taskId: string }) {
  const supabase = useSupabaseClient();
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    const subscription = supabase
      .from('agent_tasks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_tasks',
        filter: `id=eq.${taskId}`,
      }, (payload) => {
        setStatus(payload.new.status);
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [taskId]);

  return (
    <div>
      <p>Status: <strong>{status}</strong></p>
      {status === 'pending_approval' && (
        <p>⏳ Waiting for CEO approval...</p>
      )}
      {status === 'completed' && (
        <p>✅ Task completed</p>
      )}
      {status === 'failed' && (
        <p>❌ Task failed</p>
      )}
    </div>
  );
}
```

---

## From Scheduled Tasks

### Example 1: Daily Report Cron Job

**Setup via cron-job.org:**

```
POST https://your-project.supabase.co/functions/v1/chro-orchestrator
Header: Authorization: Bearer CRON_SECRET_TOKEN
Header: Content-Type: application/json

Body:
{
  "directive": "Generate daily revenue report and send to CEO",
  "source": "cron",
  "priority": 2
}
```

### Example 2: Weekly Inventory Audit

```
POST https://your-project.supabase.co/functions/v1/chro-orchestrator
Header: Authorization: Bearer CRON_SECRET_TOKEN
Header: Content-Type: application/json

Body:
{
  "directive": "Audit inventory levels and flag low stock items",
  "source": "cron",
  "priority": 3
}
```

### Example 3: Monthly Learning Analysis

```
POST https://your-project.supabase.co/functions/v1/chro-orchestrator
Header: Authorization: Bearer CRON_SECRET_TOKEN
Header: Content-Type: application/json

Body:
{
  "directive": "Analyze decision patterns from the last 30 days and update agent learning model",
  "source": "cron",
  "priority": 2
}
```

---

## CEO Approval Flow

### Step-by-Step Example: Deploy Code

**1. Agent submits task:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer AGENT_TOKEN" \
  -d '{
    "directive": "Deploy code changes from branch feature/new-payment-gateway to production",
    "source": "agent",
    "priority": 5
  }'
```

**2. Response indicates pending approval:**
```json
{
  "status": "pending_approval",
  "task_id": "task-deploy-001",
  "requires_approval": true
}
```

**3. CEO receives Telegram notification:**
```
⚠️ Task Requires Approval

Task: deploy_code
ID: task-deploy-001
Branch: feature/new-payment-gateway

Reply with "Apply koro" to approve or inline buttons to decide.
```

**4. CEO clicks "Apply koro" button:**
- Telegram webhook receives callback
- Task status updates to 'pending'
- Task executes immediately
- CEO receives completion notification

**5. Completion notification:**
```
✅ deploy_code Executed

Task ID: task-deploy-001
Execution time: 1234ms
Success!
```

---

## Testing & Debugging

### Example 1: Local Testing with curl

```bash
# Test CEO approval flow
curl -X POST http://localhost:54321/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "directive": "Create test coupon TEST123 with $10 discount",
    "source": "ceo",
    "priority": 3
  }' | jq .
```

### Example 2: Monitor Logs

```bash
# Watch edge function logs
supabase functions list
supabase functions logs chro-orchestrator --tail

# Or view in Supabase dashboard
# → Functions → chro-orchestrator → Logs
```

### Example 3: Inspect Database Records

```sql
-- View all tasks
SELECT id, task_type, status, created_at 
FROM agent_tasks 
ORDER BY created_at DESC 
LIMIT 10;

-- View specific task
SELECT * FROM agent_tasks 
WHERE id = 'task-id-here';

-- View decisions for task
SELECT * FROM agent_decisions 
WHERE task_id = 'task-id-here' 
ORDER BY created_at DESC;

-- View agent memory
SELECT context_type, content, created_at 
FROM agent_memory 
WHERE agent_id = 'CHRO' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Example 4: Simulate Telegram Approval

```bash
# Simulate callback query (button click)
curl -X POST http://localhost:54321/functions/v1/telegram-webhook-handler \
  -H "Content-Type: application/json" \
  -d '{
    "callback_query": {
      "id": "query-123",
      "from": {"id": 123456789},
      "data": "apply_task-deploy-001"
    }
  }' | jq .

# Simulate text message
curl -X POST http://localhost:54321/functions/v1/telegram-webhook-handler \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "text": "Apply koro",
      "from": {"id": 123456789},
      "chat": {"id": 123456789}
    }
  }' | jq .
```

---

## Common Patterns

### Pattern 1: Auto-Execute if Whitelisted

```typescript
const { task, decision } = await intakeDirective(directive, supabase);

if (decision?.auto_executable) {
  // Execute immediately
  const result = await executeTask(task, supabase);
  // Memory updates automatically
} else if (decision?.requires_approval) {
  // Wait for CEO
  // Webhook will execute when approved
}
```

### Pattern 2: Conditional Execution

```typescript
const { task, decision, enriched } = await intakeDirective(directive, supabase);

// Use enriched context to make decisions
const recentApprovals = enriched.context?.recent_decisions?.filter(
  (d) => d.decision_type === 'approve'
).length || 0;

if (recentApprovals > 10) {
  // High approval rate; proceed
  await executeTask(task, supabase);
} else {
  // Low approval rate; escalate
  await notifyCEOForApproval(task);
}
```

### Pattern 3: Error Handling & Retries

```typescript
async function executeWithRetry(task, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeTask(task, supabase);
      if (result.success) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}
```

### Pattern 4: Batch Processing

```typescript
async function processBatch(directives: string[]) {
  const results = [];
  
  for (const directive of directives) {
    const { task, decision } = await intakeDirective(
      { directive, source: 'cron', priority: 2 },
      supabase
    );
    
    if (task && decision?.proceed) {
      const validation = await validateTaskPreExecution(task, supabase);
      if (validation.valid) {
        const result = await executeTask(task, supabase);
        results.push({
          directive,
          task_id: task.id,
          success: result.success,
        });
      }
    }
  }
  
  return results;
}
```

---

## Deployment Checklist

### Before Deploying

- [ ] All 5 apply-flow-*.ts files in `supabase/functions/_shared/`
- [ ] Test suite created and passing
- [ ] Telegram bot configured (bot ID, chat ID in agent_config)
- [ ] Slack webhook configured (if using)
- [ ] Database tables verified (agent_tasks, agent_memory, agent_decisions, etc.)
- [ ] RPC functions implemented
- [ ] Environment variables set (TELEGRAM_BOT_TOKEN, etc.)

### Deploy

```bash
# Push to Git
git add supabase/functions/_shared/apply-flow-*.ts
git add supabase/functions/telegram-webhook-handler/
git commit -m "Module 23: Apply Flow + Telegram Webhook"
git push origin main

# Hostinger auto-deploys (2-3 minutes)
```

### Post-Deploy Verification

```bash
# Test intake workflow
curl -X POST https://your-project.supabase.co/functions/v1/chro-orchestrator \
  -H "Authorization: Bearer test-token" \
  -d '{"directive":"Test task","source":"ceo"}'

# Check logs
supabase functions logs chro-orchestrator --tail

# Monitor database
SELECT COUNT(*) FROM agent_tasks;
SELECT COUNT(*) FROM agent_decisions;
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Unauthorized: admin role required"
- **Solution**: Ensure token bearer has admin role. Check: `has_role(user_id, 'admin')`

**Issue**: "Task not created"
- **Solution**: Check Supabase database permissions. Verify RLS policies are correct.

**Issue**: "Telegram notification not sent"
- **Solution**: Verify TELEGRAM_BOT_TOKEN and chat_id in agent_config.settings

**Issue**: "Memory not updating"
- **Solution**: Check that `upsert_agent_learning` RPC function exists and is callable.

---

**Status**: Integration Examples Complete ✅

Ready for deployment and testing.
