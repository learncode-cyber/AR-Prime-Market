-- Module 23: ARQ Master OS Agent Tables & Functions
-- Creates all required infrastructure for Apply Flow system

-- Table 1: agent_tasks
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source VARCHAR(20) NOT NULL,
  source_user_id UUID,
  priority INTEGER NOT NULL DEFAULT 3,
  input_data JSONB,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
CREATE INDEX idx_agent_tasks_source ON agent_tasks(source);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- Table 2: agent_memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,
  retention_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_context_type ON agent_memory(context_type);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- Table 3: agent_decisions
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL,
  decision_type VARCHAR(50) NOT NULL,
  decision_reasoning JSONB,
  approved_by UUID,
  approval_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_decisions_task_id ON agent_decisions(task_id);
CREATE INDEX idx_agent_decisions_created_at ON agent_decisions(created_at DESC);

ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

-- Table 4: agent_config
CREATE TABLE IF NOT EXISTS public.agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR(50) NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}',
  rate_limit_auto_exec INTEGER DEFAULT 100,
  rate_limit_escalated INTEGER DEFAULT 10,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

INSERT INTO agent_config (agent_type, settings) VALUES (
  'CHRO',
  '{"telegram_bot_token":"SET_VIA_ENV","notification_channels":["telegram"]}'::jsonb
) ON CONFLICT (agent_type) DO NOTHING;

-- Table 5: agent_notifications
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  recipient VARCHAR(100),
  subject TEXT,
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_notifications_task_id ON agent_notifications(task_id);
CREATE INDEX idx_agent_notifications_created_at ON agent_notifications(created_at DESC);

ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- Table 6: performance_metrics (Module 24)
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name VARCHAR(50) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_metrics_stage ON performance_metrics(stage_name);
CREATE INDEX idx_perf_metrics_created_at ON performance_metrics(created_at DESC);

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- RPC Functions
CREATE OR REPLACE FUNCTION public.has_role(
  user_id UUID,
  role_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  IF role_name = 'admin' THEN
    RETURN user_id::text IN (SELECT id::text FROM auth.users WHERE email LIKE '%@admin%');
  ELSIF role_name = 'agent' THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

