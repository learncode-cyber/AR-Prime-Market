/**
 * ARQ Master OS - Apply Flow Memory & Learning Engine
 * Stage 5: Memory Update & Decision Logging
 * 
 * Persists task outcomes, updates agent memory,
 * and feeds decisions into the learning engine.
 */

import { SupabaseClient } from 'jsfetch';
import {
  AgentTask,
  ExecutionResult,
  AgentMemory,
  DecisionType,
} from './apply-flow-types.ts';

// ============================================================================
// STAGE 5: MEMORY & LEARNING UPDATE
// ============================================================================

/**
 * Update agent memory after task completion
 * Stores decision, outcome, and learning signals
 */
export async function updateAgentMemory(
  task: AgentTask,
  executionResult: ExecutionResult,
  client: SupabaseClient
): Promise<boolean> {
  try {
    const { task_type, input_data, id: task_id, status } = task;
    const { success, execution_time_ms, retry_count } = executionResult;

    // Determine decision type from result
    const decisionType: DecisionType = success ? 'approve' : 'deny';

    // Record decision
    const { error: decisionError } = await client
      .from('agent_decisions')
      .insert({
        task_id,
        decision_type: decisionType,
        reasoning: success
          ? `Task ${task_type} executed successfully`
          : `Task ${task_type} failed`,
        parameters: {
          execution_time_ms,
          retry_count,
          task_input_summary: summarizeInput(input_data),
        },
        created_at: new Date().toISOString(),
      });

    if (decisionError) {
      console.error('[apply-flow-memory] Failed to record decision:', decisionError);
      return false;
    }

    // Update agent memory with task outcome
    const memoryContent = buildMemoryContent(task, executionResult);

    const { error: memoryError } = await client.from('agent_memory').insert({
      agent_id: 'CHRO',
      context_type: 'learning',
      content: memoryContent,
      created_at: new Date().toISOString(),
    });

    if (memoryError) {
      console.error('[apply-flow-memory] Failed to update memory:', memoryError);
      return false;
    }

    // Feed into learning engine
    await feedLearningEngine(task, executionResult, client);

    return true;
  } catch (error) {
    console.error('[apply-flow-memory] Update failed:', error);
    return false;
  }
}

// ============================================================================
// MEMORY BUILDING
// ============================================================================

/**
 * Build memory content structure from task outcome
 */
function buildMemoryContent(
  task: AgentTask,
  result: ExecutionResult
): Record<string, unknown> {
  const { task_type, input_data, created_at } = task;
  const { success, execution_time_ms, retry_count } = result;

  const baseContent = {
    task_type,
    success,
    execution_time_ms,
    retry_count,
    timestamp: new Date().toISOString(),
  };

  // Task-specific memory
  switch (task_type) {
    case 'coupon_create':
    case 'coupon_update':
      return {
        ...baseContent,
        coupon_code: input_data.code,
        discount_value: input_data.discount_value,
        discount_type: input_data.discount_type,
        min_order: input_data.min_order_amount,
      };

    case 'order_mark_shipped':
    case 'order_process':
      return {
        ...baseContent,
        order_id: input_data.order_id,
      };

    case 'price_change':
      return {
        ...baseContent,
        product_id: input_data.product_id,
        new_price: input_data.new_price,
      };

    case 'generate_report':
      return {
        ...baseContent,
        report_type: input_data.report_type,
      };

    case 'email_notify':
      return {
        ...baseContent,
        recipient: maskEmail(String(input_data.recipient)),
        template: input_data.template,
      };

    default:
      return baseContent;
  }
}

/**
 * Summarize input data for audit trail (no PII)
 */
function summarizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    // Skip PII fields
    if (
      ['email', 'password', 'phone', 'address', 'credit_card'].some((pii) =>
        key.toLowerCase().includes(pii)
      )
    ) {
      summary[key] = '[REDACTED]';
      continue;
    }

    // Summarize
    if (typeof value === 'string' && value.length > 50) {
      summary[key] = value.substring(0, 50) + '...';
    } else {
      summary[key] = value;
    }
  }

  return summary;
}

/**
 * Mask email for logging
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[invalid-email]';
  const masked = local.substring(0, 2) + '*'.repeat(local.length - 2);
  return `${masked}@${domain}`;
}

// ============================================================================
// LEARNING ENGINE INTEGRATION
// ============================================================================

/**
 * Feed task outcome into agent learning engine
 * Updates agent_learning_logs for cross-agent insight
 */
export async function feedLearningEngine(
  task: AgentTask,
  result: ExecutionResult,
  client: SupabaseClient
): Promise<boolean> {
  try {
    const { task_type, input_data } = task;
    const { success } = result;

    // Determine learning category
    let learningKey: string;
    let learningValue: Record<string, unknown>;

    switch (task_type) {
      case 'coupon_create':
      case 'coupon_update':
        learningKey = 'coupon_operations';
        learningValue = {
          action: task_type.split('_')[1],
          code: input_data.code,
          discount: input_data.discount_value,
          success,
        };
        break;

      case 'order_mark_shipped':
        learningKey = 'order_operations';
        learningValue = {
          action: 'mark_shipped',
          success,
        };
        break;

      case 'price_change':
        learningKey = 'pricing_decisions';
        learningValue = {
          action: 'price_change',
          product_id: input_data.product_id,
          new_price: input_data.new_price,
          success,
        };
        break;

      case 'generate_report':
        learningKey = 'reporting_operations';
        learningValue = {
          action: 'generate',
          report_type: input_data.report_type,
          success,
        };
        break;

      default:
        return true; // Skip non-learnable tasks
    }

    // Upsert into learning logs
    const { error } = await client.rpc('upsert_agent_learning', {
      p_source_agent: 'chro-orchestrator',
      p_scope: learningKey,
      p_key: `${task_type}_${new Date().getTime()}`,
      p_value: learningValue,
      p_expires_days: 90,
    });

    if (error) {
      console.error('[apply-flow-memory] Learning engine update failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[apply-flow-memory] Learning engine error:', error);
    return false;
  }
}

// ============================================================================
// OPERATIONAL MEMORY UPDATE
// ============================================================================

/**
 * Update operational memory (current state, metrics, etc.)
 */
export async function updateOperationalMemory(
  agentId: string,
  updates: Record<string, unknown>,
  client: SupabaseClient
): Promise<boolean> {
  try {
    // Load current operational memory
    const { data: currentResp } = await client
      .from('agent_memory')
      .select('content')
      .eq('agent_id', agentId)
      .eq('context_type', 'operational')
      .order('created_at', { ascending: false })
      .limit(1);

    const currentMemory = currentResp?.[0]?.content || {};

    // Merge updates
    const mergedMemory = {
      ...currentMemory,
      ...updates,
      last_updated: new Date().toISOString(),
    };

    // Insert new version (time-series pattern)
    const { error } = await client.from('agent_memory').insert({
      agent_id: agentId,
      context_type: 'operational',
      content: mergedMemory,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[apply-flow-memory] Operational update failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[apply-flow-memory] Operational update error:', error);
    return false;
  }
}

// ============================================================================
// DECISION PATTERN ANALYSIS
// ============================================================================

/**
 * Analyze decision patterns for continuous improvement
 * (Called periodically, e.g., daily)
 */
export async function analyzeDecisionPatterns(
  agentId: string,
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  try {
    // Get recent decisions (last 30 days)
    const { data: decisions } = await client
      .from('agent_decisions')
      .select('decision_type, parameters->task_type, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!decisions || decisions.length === 0) {
      return { message: 'No recent decisions' };
    }

    // Analyze patterns
    const stats = {
      total_decisions: decisions.length,
      approvals: decisions.filter((d) => d.decision_type === 'approve').length,
      denials: decisions.filter((d) => d.decision_type === 'deny').length,
      deferrals: decisions.filter((d) => d.decision_type === 'defer').length,
      escalations: decisions.filter((d) => d.decision_type === 'escalate').length,
    };

    const approvalRate = ((stats.approvals / stats.total_decisions) * 100).toFixed(2);
    const denialRate = ((stats.denials / stats.total_decisions) * 100).toFixed(2);

    // Task type breakdown
    const byTaskType: Record<string, number> = {};
    for (const d of decisions) {
      const taskType = d.task_type || 'unknown';
      byTaskType[taskType] = (byTaskType[taskType] || 0) + 1;
    }

    return {
      period: 'last_30_days',
      ...stats,
      approval_rate_percent: approvalRate,
      denial_rate_percent: denialRate,
      by_task_type: byTaskType,
      analyzed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[apply-flow-memory] Pattern analysis error:', error);
    return { error: String(error) };
  }
}

// ============================================================================
// MEMORY RETENTION & CLEANUP
// ============================================================================

/**
 * Clean up expired memory entries
 * (Should run daily or weekly)
 */
export async function cleanupExpiredMemory(
  client: SupabaseClient
): Promise<{ deleted_count: number }> {
  try {
    const { data: result } = await client.rpc('cleanup_expired_memory', {
      p_now: new Date().toISOString(),
    });

    return { deleted_count: result?.count || 0 };
  } catch (error) {
    console.error('[apply-flow-memory] Cleanup error:', error);
    return { deleted_count: 0 };
  }
}

// ============================================================================
// MEMORY EXPORT (for CEO briefing)
// ============================================================================

/**
 * Export agent memory context for CEO briefing
 */
export async function exportMemoryForBriefing(
  agentId: string,
  client: SupabaseClient
): Promise<Record<string, unknown> | null> {
  try {
    const { data: operational } = await client
      .from('agent_memory')
      .select('content')
      .eq('agent_id', agentId)
      .eq('context_type', 'operational')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: learning } = await client
      .from('agent_memory')
      .select('content')
      .eq('agent_id', agentId)
      .eq('context_type', 'learning')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: recentDecisions } = await client
      .from('agent_decisions')
      .select('decision_type, reasoning, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      agent_id: agentId,
      operational: operational?.[0]?.content,
      learning_insights: learning?.map((l) => l.content),
      recent_decisions: recentDecisions,
      exported_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[apply-flow-memory] Export error:', error);
    return null;
  }
}
