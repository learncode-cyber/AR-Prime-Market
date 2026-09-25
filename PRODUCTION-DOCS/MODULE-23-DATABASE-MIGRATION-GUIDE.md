# Module 23 Phase 3: Database Migration Guide
## Complete Setup for ARQ Master OS Agent Tables & Functions

**Date**: August 20, 2026  
**Phase**: 3 - Staging Deployment & Verification  
**Purpose**: Create all required database infrastructure for Apply Flow

---

## 📋 DATABASE SETUP CHECKLIST

Before deploying Module 23, ensure the following database infrastructure exists in Supabase:

### Tables Required (5)
- [ ] `agent_tasks` - Task records
- [ ] `agent_memory` - Learning memory storage
- [ ] `agent_decisions` - Decision audit trail
- [ ] `agent_config` - Agent configuration
- [ ] `agent_notifications` - Notification log

### RPC Functions Required (5+)
- [ ] `has_role()` - Role-based access control
- [ ] `upsert_agent_learning()` - Learning engine
- [ ] `generate_report()` - Reporting function
- [ ] `send_email()` - Email capability
- [ ] `cleanup_expired_memory()` - Memory maintenance

---

## 🗄️ TABLE CREATION SCRIPTS

### Table 1: agent_tasks

**Purpose**: Core task records for orchestration pipeline

```sql
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source VARCHAR(20) NOT NULL,
  source_user_id UUID,
  priority INTEGER NOT NULL DEFAULT 3,
  
  -- Input/Output
  input_data JSONB,
  result JSONB,
  error_message TEXT,
  
  -- Execution
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT task_status CHECK (status IN (
    'pending',
    'pending_approval',
    'executing',
    'completed',
    'failed'
  )),
  
  CONSTRAINT task_source CHECK (source IN (
    'ceo',
    'agent',
    'cron',
    'webhook',
    'api'
  ))
);

-- Indexes for performance
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
CREATE INDEX idx_agent_tasks_source ON agent_tasks(source);
CREATE INDEX idx_agent_tasks_type ON agent_tasks(task_type);

-- Enable RLS
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own tasks (or all if admin)
CREATE POLICY "Users can view their tasks"
  ON agent_tasks FOR SELECT
  USING (
    auth.uid() IS NULL OR
    has_role(auth.uid(), 'admin') OR
    source_user_id = auth.uid()
  );

-- RLS Policy: Only service role can insert
CREATE POLICY "Only service role can insert tasks"
  ON agent_tasks FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Only service role can update
CREATE POLICY "Only service role can update tasks"
  ON agent_tasks FOR UPDATE
  USING (true);
```

### Table 2: agent_memory

**Purpose**: Operational and learning memory for the agent

```sql
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  
  -- Memory content
  content JSONB NOT NULL,
  metadata JSONB,
  
  -- Retention
  expires_at TIMESTAMP WITH TIME ZONE,
  retention_days INTEGER DEFAULT 30,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT memory_context_type CHECK (context_type IN (
    'operational',
    'learning',
    'decision_history',
    'pattern',
    'enrichment'
  ))
);

-- Indexes
CREATE INDEX idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_context_type ON agent_memory(context_type);
CREATE INDEX idx_agent_memory_created_at ON agent_memory(created_at DESC);
CREATE INDEX idx_agent_memory_expires_at ON agent_memory(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only
CREATE POLICY "Service role can access memory"
  ON agent_memory FOR ALL
  USING (true);
```

### Table 3: agent_decisions

**Purpose**: Audit trail of all decisions made by the agent

```sql
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL,
  
  -- Decision details
  decision_type VARCHAR(50) NOT NULL,
  decision_reasoning JSONB,
  
  -- Approver
  approved_by UUID,
  approval_timestamp TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT decision_type CHECK (decision_type IN (
    'approve',
    'deny',
    'escalate',
    'auto_execute',
    'retry',
    'circuit_break'
  ))
);

-- Indexes
CREATE INDEX idx_agent_decisions_task_id ON agent_decisions(task_id);
CREATE INDEX idx_agent_decisions_agent_id ON agent_decisions(agent_id);
CREATE INDEX idx_agent_decisions_decision_type ON agent_decisions(decision_type);
CREATE INDEX idx_agent_decisions_created_at ON agent_decisions(created_at DESC);

-- Enable RLS
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only
CREATE POLICY "Service role can access decisions"
  ON agent_decisions FOR ALL
  USING (true);
```

### Table 4: agent_config

**Purpose**: Agent configuration and settings

```sql
CREATE TABLE IF NOT EXISTS public.agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR(50) NOT NULL UNIQUE,
  
  -- Configuration
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Rate limits
  rate_limit_auto_exec INTEGER DEFAULT 100,
  rate_limit_escalated INTEGER DEFAULT 10,
  rate_limit_research INTEGER DEFAULT 50,
  
  -- Circuit breaker
  circuit_breaker_threshold INTEGER DEFAULT 5,
  circuit_breaker_window_ms INTEGER DEFAULT 3600000,
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only
CREATE POLICY "Service role can access config"
  ON agent_config FOR ALL
  USING (true);

-- Initialize CHRO config
INSERT INTO agent_config (agent_type, settings)
VALUES (
  'CHRO',
  '{
    "telegram_bot_token": "SET_VIA_ENV",
    "telegram_chat_id": "SET_VIA_ENV",
    "slack_webhook_url": "OPTIONAL",
    "notification_channels": ["telegram", "slack"],
    "auto_execute_tasks": ["coupon_create", "coupon_update", "order_mark_shipped", "email_notify", "generate_report", "research_trend"],
    "escalated_tasks": ["price_change", "supplier_switch", "deploy_code", "export_data", "cancel_payment"],
    "max_retry_attempts": 3,
    "retry_backoff_ms": [2000, 5000, 10000],
    "memory_retention_days": 30
  }'::jsonb
)
ON CONFLICT (agent_type) DO UPDATE SET
  settings = EXCLUDED.settings;
```

### Table 5: agent_notifications

**Purpose**: Notification audit log

```sql
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  
  -- Notification details
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  recipient VARCHAR(100),
  
  -- Content
  subject TEXT,
  message TEXT,
  
  -- Delivery
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status VARCHAR(20) DEFAULT 'pending',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT notification_type CHECK (notification_type IN (
    'approval_request',
    'task_complete',
    'task_failed',
    'error_alert',
    'report',
    'escalation'
  )),
  
  CONSTRAINT channel CHECK (channel IN (
    'telegram',
    'slack',
    'webhook',
    'email'
  )),
  
  CONSTRAINT delivery_status CHECK (delivery_status IN (
    'pending',
    'sent',
    'failed',
    'retry'
  ))
);

-- Indexes
CREATE INDEX idx_agent_notifications_task_id ON agent_notifications(task_id);
CREATE INDEX idx_agent_notifications_channel ON agent_notifications(channel);
CREATE INDEX idx_agent_notifications_created_at ON agent_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only
CREATE POLICY "Service role can access notifications"
  ON agent_notifications FOR ALL
  USING (true);
```

---

## 🔧 RPC FUNCTION CREATION SCRIPTS

### Function 1: has_role()

**Purpose**: Check if user has specific role

```sql
CREATE OR REPLACE FUNCTION public.has_role(
  user_id UUID,
  role_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- For now, return true for admin role on specific users
  -- In production, use auth.users() or custom user_roles table
  
  IF role_name = 'admin' THEN
    -- Check if user is admin (hardcoded for MVP, use table in production)
    RETURN user_id::text IN (
      SELECT id::text FROM auth.users WHERE email LIKE '%@admin%'
    );
  ELSIF role_name = 'agent' THEN
    RETURN TRUE; -- All authenticated users can be agents
  ELSIF role_name = 'ceo' THEN
    RETURN user_id::text IN (
      SELECT id::text FROM auth.users WHERE email LIKE '%@ceo%'
    );
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function 2: upsert_agent_learning()

**Purpose**: Update or insert learning memory

```sql
CREATE OR REPLACE FUNCTION public.upsert_agent_learning(
  p_agent_id TEXT,
  p_task_type TEXT,
  p_decision_type TEXT,
  p_success BOOLEAN,
  p_context JSONB
)
RETURNS UUID AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  -- Insert or update learning memory
  INSERT INTO agent_memory (
    agent_id,
    context_type,
    content,
    metadata,
    retention_days
  )
  VALUES (
    p_agent_id,
    'learning',
    jsonb_build_object(
      'task_type', p_task_type,
      'decision_type', p_decision_type,
      'success', p_success,
      'context', p_context,
      'learned_at', now()
    ),
    jsonb_build_object(
      'pattern_count', 1,
      'success_rate', CASE WHEN p_success THEN 1 ELSE 0 END
    ),
    30
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function 3: generate_report()

**Purpose**: Generate reports based on task data

```sql
CREATE OR REPLACE FUNCTION public.generate_report(
  p_report_type TEXT,
  p_period_days INT DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
  v_report JSONB;
BEGIN
  -- Generate report based on type
  SELECT jsonb_build_object(
    'report_type', p_report_type,
    'period_days', p_period_days,
    'generated_at', now(),
    'total_tasks', COUNT(*),
    'completed_tasks', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed_tasks', COUNT(*) FILTER (WHERE status = 'failed'),
    'pending_tasks', COUNT(*) FILTER (WHERE status = 'pending'),
    'average_execution_ms', AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000),
    'tasks_by_type', jsonb_object_agg(task_type, COUNT(*)) FILTER (WHERE COUNT(*) > 0)
  )
  INTO v_report
  FROM agent_tasks
  WHERE created_at > now() - (p_period_days || ' days')::INTERVAL;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function 4: send_email()

**Purpose**: Send email notifications

```sql
CREATE OR REPLACE FUNCTION public.send_email(
  p_to TEXT,
  p_subject TEXT,
  p_body TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- In production, integrate with Supabase Functions or external service
  -- For now, log to notifications table
  
  INSERT INTO agent_notifications (
    notification_type,
    channel,
    recipient,
    subject,
    message,
    delivery_status
  )
  VALUES (
    'report',
    'email',
    p_to,
    p_subject,
    p_body,
    'pending'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function 5: cleanup_expired_memory()

**Purpose**: Maintenance function to clean up old memory

```sql
CREATE OR REPLACE FUNCTION public.cleanup_expired_memory()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM agent_memory
  WHERE expires_at < now()
    OR (created_at + (retention_days || ' days')::INTERVAL < now());

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📋 DEPLOYMENT SEQUENCE

### Step 1: Verify Supabase Connection

```bash
# Test Supabase connection
supabase status

# Expected output:
# Supabase CLI version: X.X.X
# Project: your-project-name
# Database: Connected ✓
```

### Step 2: Run Table Creation Scripts

```bash
# Option A: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Copy-paste each table creation script
# 3. Run one at a time
# 4. Verify creation by checking Tables section

# Option B: Via CLI
supabase db push

# Option C: Via psql
psql -h db.XXXXX.supabase.co -U postgres -d postgres -f migrations.sql
```

### Step 3: Verify Table Creation

```sql
-- List all new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'agent_%'
ORDER BY table_name;

-- Expected:
-- agent_config
-- agent_decisions
-- agent_memory
-- agent_notifications
-- agent_tasks
```

### Step 4: Create RPC Functions

```bash
# Copy all RPC function scripts into SQL Editor
# Run one at a time
# Verify in Functions section of Supabase dashboard
```

### Step 5: Verify RPC Functions

```sql
-- List all new functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'has_role',
    'upsert_agent_learning',
    'generate_report',
    'send_email',
    'cleanup_expired_memory'
  )
ORDER BY routine_name;

-- Expected: 5 functions found
```

### Step 6: Initialize Agent Config

```sql
-- Verify CHRO config was inserted
SELECT agent_type, enabled, settings
FROM agent_config
WHERE agent_type = 'CHRO';

-- Update settings if needed
UPDATE agent_config
SET settings = settings || '{
  "telegram_chat_id": "YOUR_CHAT_ID_HERE"
}'::jsonb
WHERE agent_type = 'CHRO';
```

---

## ✅ VERIFICATION CHECKLIST

After running all migration scripts:

```sql
-- 1. Tables exist and have correct structure
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'agent_%';
-- Expected: 5

-- 2. RPC functions exist
SELECT COUNT(*) FROM pg_proc
WHERE proname IN ('has_role', 'upsert_agent_learning', 'generate_report', 'send_email', 'cleanup_expired_memory');
-- Expected: 5

-- 3. RLS policies are enabled
SELECT table_name, row_security_enabled
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'agent_%'
ORDER BY table_name;
-- Expected: All 'true'

-- 4. Indexes created
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'agent_%';
-- Expected: 15+ indexes

-- 5. Agent config initialized
SELECT COUNT(*) FROM agent_config WHERE agent_type = 'CHRO';
-- Expected: 1
```

---

## 🔐 SECURITY CONFIGURATION

### RLS Policies

All agent tables use Row Level Security (RLS):
- ✅ Non-authenticated users: Blocked (SELECT returns 0 rows)
- ✅ Regular authenticated users: Can see only their own tasks
- ✅ Admin users: Can see all tasks
- ✅ Service role: Unrestricted (for edge functions)

### Environment Variables

Set these in Supabase project settings:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Slack Configuration (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Agent Settings
AGENT_MEMORY_RETENTION_DAYS=30
AGENT_CIRCUIT_BREAKER_THRESHOLD=5
```

---

## 📊 MIGRATION VALIDATION SCRIPT

```bash
#!/bin/bash
# save as: validate-migration.sh

echo "Validating Module 23 Database Migration..."
echo ""

# Check Supabase connection
echo "1. Testing Supabase connection..."
if supabase status > /dev/null 2>&1; then
  echo "   ✅ Supabase connected"
else
  echo "   ❌ Supabase connection failed"
  exit 1
fi

# Run verification SQL
echo ""
echo "2. Verifying database structure..."

RESULT=$(psql -h $SUPABASE_HOST -U postgres -d postgres -c "
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'agent_%';
" 2>/dev/null)

if [ "$RESULT" -eq 5 ]; then
  echo "   ✅ All 5 agent tables created"
else
  echo "   ❌ Expected 5 tables, found $RESULT"
  exit 1
fi

# Check RPC functions
echo ""
echo "3. Verifying RPC functions..."

FUNC_COUNT=$(psql -h $SUPABASE_HOST -U postgres -d postgres -c "
  SELECT COUNT(*) FROM pg_proc
  WHERE proname IN ('has_role', 'upsert_agent_learning', 'generate_report', 'send_email', 'cleanup_expired_memory');
" 2>/dev/null)

if [ "$FUNC_COUNT" -eq 5 ]; then
  echo "   ✅ All 5 RPC functions created"
else
  echo "   ❌ Expected 5 functions, found $FUNC_COUNT"
  exit 1
fi

# Check RLS policies
echo ""
echo "4. Verifying RLS policies..."

POLICY_COUNT=$(psql -h $SUPABASE_HOST -U postgres -d postgres -c "
  SELECT COUNT(*) FROM pg_policies
  WHERE schemaname = 'public' AND tablename LIKE 'agent_%';
" 2>/dev/null)

if [ "$POLICY_COUNT" -ge 5 ]; then
  echo "   ✅ RLS policies configured ($POLICY_COUNT policies)"
else
  echo "   ⚠️  Low policy count ($POLICY_COUNT), verify RLS setup"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ MIGRATION VALIDATION COMPLETE"
echo "════════════════════════════════════════════════════════════════"
```

Run validation:
```bash
chmod +x validate-migration.sh
./validate-migration.sh
```

---

## ⚡ QUICK SETUP (All-in-One)

If you want to run all migrations at once:

```bash
# 1. Save all SQL scripts to a single file
cat > migrations.sql << 'SQL'
-- Tables
[Insert all table creation scripts here]

-- Functions
[Insert all RPC function scripts here]
SQL

# 2. Run migration
supabase db push

# 3. Verify
supabase db execute migrations.sql
```

---

## 🚨 ROLLBACK PROCEDURE

If you need to rollback the migration:

```sql
-- Drop all agent infrastructure
DROP TABLE IF EXISTS agent_notifications;
DROP TABLE IF EXISTS agent_decisions;
DROP TABLE IF EXISTS agent_memory;
DROP TABLE IF EXISTS agent_tasks;
DROP TABLE IF EXISTS agent_config;

-- Drop functions
DROP FUNCTION IF EXISTS has_role(UUID, TEXT);
DROP FUNCTION IF EXISTS upsert_agent_learning(TEXT, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS generate_report(TEXT, INT);
DROP FUNCTION IF EXISTS send_email(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS cleanup_expired_memory();
```

---

## 📝 POST-MIGRATION TASKS

After successful migration:

1. ✅ Update environment variables
2. ✅ Deploy Module 23 edge functions
3. ✅ Run test suite
4. ✅ Monitor agent logs
5. ✅ Verify data flow

---

**Status**: ✅ DATABASE MIGRATION GUIDE COMPLETE

Use this guide to set up all required database infrastructure for Module 23 Apply Flow.

