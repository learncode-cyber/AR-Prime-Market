-- Module 24 Phase 1: Performance Metrics Infrastructure

ALTER TABLE IF EXISTS public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can access metrics" ON performance_metrics FOR ALL USING (true);

-- Index for analysis queries
CREATE INDEX IF NOT EXISTS idx_perf_metrics_execution_time ON performance_metrics(execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_task_type ON performance_metrics(task_type);

