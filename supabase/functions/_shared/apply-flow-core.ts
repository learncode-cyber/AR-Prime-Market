/**
 * ARQ Master OS - Apply Flow Core Implementation
 * Stages 1-2: Intake & Context Loading
 * 
 * This module handles the complete workflow from directive intake
 * through context loading and authorization.
 */

import { createClient, SupabaseClient } from 'jsfetch';
import {
  Directive,
  ClassifiedDirective,
  AgentTask,
  AgentContext,
  AuthorizationResult,
  ApplyDecision,
  DecisionType,
  TaskType,
  TaskStatus,
  ValidationResult,
  ValidationError,
  ErrorSeverity,
  WHITELISTED_AUTO_EXECUTE,
  SENSITIVE_TASKS,
  TASK_TYPE_TO_ENTITY,
  TIMEOUTS,
  RATE_LIMITS,
} from './apply-flow-types.ts';

// ============================================================================
// STAGE 1: INTAKE & VALIDATION
// ============================================================================

/**
 * Validate directive source and authorization
 * Returns 401 if not authorized, or authorization details
 */
export async function validateDirectiveSource(
  directive: Directive,
  client: SupabaseClient,
  ceoUserId?: string
): Promise<AuthorizationResult> {
  const { source, user_id } = directive;

  switch (source) {
    case 'ceo':
      // CEO directives always authorized
      return {
        authorized: true,
        role: 'ceo',
        scope: ['*'], // Full access
      };

    case 'agent':
      // Agent directives require valid agent role
      if (!user_id) {
        return {
          authorized: false,
          reason: 'Agent directive missing user_id',
        };
      }
      // Check if user has agent role
      const { data: agentRole } = await client.rpc('has_role', {
        user_id: user_id,
        role: 'agent',
      });
      if (!agentRole) {
        return {
          authorized: false,
          reason: 'User does not have agent role',
        };
      }
      return {
        authorized: true,
        role: 'agent',
        scope: ['read', 'write'], // Limited access
      };

    case 'cron':
      // Cron jobs use internal scheduling token
      return {
        authorized: true,
        role: 'cron',
        scope: ['whitelisted_only'],
      };

    case 'webhook':
      // Webhooks verified by signature
      return {
        authorized: true,
        role: 'webhook',
        scope: ['specific_actions'],
      };

    case 'api':
      // API calls must have valid auth token
      if (!user_id) {
        return {
          authorized: false,
          reason: 'API directive missing authentication',
        };
      }
      return {
        authorized: true,
        role: 'api_user',
        scope: ['public_only'],
      };

    default:
      return {
        authorized: false,
        reason: `Unknown source: ${source}`,
      };
  }
}

/**
 * Classify directive into structured task format
 * Parses human-readable directive into intent, entity, action, params
 */
export async function classifyDirective(
  directive: Directive
): Promise<ClassifiedDirective | null> {
  const { directive: text } = directive;

  // Intent classification patterns
  const patterns: [RegExp, TaskType, string, string][] = [
    // Coupon operations
    [/create.*coupon.*?(\w+).*?\$?([\d.]+)/i, 'coupon_create', 'coupons', 'create'],
    [/update.*coupon.*?(\w+)/i, 'coupon_update', 'coupons', 'update'],
    [/delete.*coupon.*?(\w+)/i, 'coupon_delete', 'coupons', 'delete'],

    // Order operations
    [/mark.*shipped.*order.*?(\w+)/i, 'order_mark_shipped', 'orders', 'execute'],
    [/process.*order.*?(\w+)/i, 'order_process', 'orders', 'execute'],

    // Notifications
    [/send.*email.*notif/i, 'email_notify', 'notifications', 'execute'],

    // Reporting
    [/generate.*report/i, 'generate_report', 'reports', 'report'],

    // Research
    [/research.*trend/i, 'research_trend', 'research', 'report'],

    // Price changes
    [/change.*price.*product/i, 'price_change', 'products', 'update'],

    // Supplier
    [/switch.*supplier/i, 'supplier_switch', 'suppliers', 'update'],

    // Deployment
    [/deploy.*code/i, 'deploy_code', 'deployments', 'execute'],

    // Exports
    [/export.*data/i, 'export_data', 'exports', 'execute'],

    // Payments
    [/cancel.*payment/i, 'cancel_payment', 'payments', 'update'],
  ];

  // Try to match directive text
  for (const [pattern, taskType, entity, action] of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Extract parameters from match groups
      const params: Record<string, unknown> = {};
      if (match[1]) params.code_or_id = match[1];
      if (match[2]) params.value = parseFloat(match[2]);

      return {
        ...directive,
        task_type: taskType as TaskType,
        entity,
        action: action as 'create' | 'read' | 'update' | 'delete' | 'execute' | 'report',
        params,
      };
    }
  }

  // If no pattern matched, mark as custom
  return {
    ...directive,
    task_type: 'custom_action',
    entity: 'custom',
    action: 'execute',
    params: { raw_directive: text },
  };
}

/**
 * Create task record in agent_tasks table
 */
export async function createTaskRecord(
  classified: ClassifiedDirective,
  client: SupabaseClient
): Promise<AgentTask | null> {
  const {
    task_type,
    params,
    source,
    priority = 3,
    user_id,
    request_id,
  } = classified;

  const { data, error } = await client
    .from('agent_tasks')
    .insert({
      status: 'pending' as TaskStatus,
      priority,
      task_type,
      input_data: params,
      assigned_agent: 'CHRO',
      source,
      user_id,
      request_id,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[apply-flow] Failed to create task record:', error);
    return null;
  }

  return data as AgentTask;
}

// ============================================================================
// STAGE 2: CONTEXT LOADING
// ============================================================================

/**
 * Load agent memory context from database
 * Fetches operational, learning, and decision history
 */
export async function loadAgentContext(
  agentId: string,
  client: SupabaseClient
): Promise<AgentContext | null> {
  try {
    // Load operational & learning memory (parallel queries)
    const [operationalResp, learningResp, decisionsResp, configResp] = await Promise.all([
      client
        .from('agent_memory')
        .select('content')
        .eq('agent_id', agentId)
        .eq('context_type', 'operational')
        .order('created_at', { ascending: false })
        .limit(1),

      client
        .from('agent_memory')
        .select('content')
        .eq('agent_id', agentId)
        .eq('context_type', 'learning')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('created_at', { ascending: false })
        .limit(5),

      client
        .from('agent_decisions')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(20),

      client
        .from('agent_config')
        .select('settings')
        .eq('agent_type', agentId)
        .single(),
    ]);

    // Merge operational memory
    const operational_memory = operationalResp.data?.[0]?.content || {};

    // Merge learning memory
    const learning_memory = learningResp.data?.reduce(
      (acc, row) => ({ ...acc, ...row.content }),
      {}
    ) || {};

    // Process decisions
    const recent_decisions = decisionsResp.data || [];

    // Get config
    const config = configResp.data?.settings || {};

    return {
      agent_id: agentId,
      operational_memory,
      learning_memory,
      recent_decisions: recent_decisions as any,
      config,
    };
  } catch (error) {
    console.error('[apply-flow] Failed to load agent context:', error);
    return null;
  }
}

/**
 * Enrich task with context (agent memory + history)
 */
export function enrichTaskWithContext(
  task: AgentTask,
  context: AgentContext | null
): Record<string, unknown> {
  if (!context) {
    return {
      task,
      context: null,
      enrichment_status: 'no_context_available',
    };
  }

  // Merge task input with relevant context
  const relevantMemory = filterRelevantMemory(task.task_type, context);

  return {
    task,
    context: {
      agent_id: context.agent_id,
      relevant_memory: relevantMemory,
      recent_decisions: context.recent_decisions.slice(0, 5),
      has_prior_approvals: context.recent_decisions.some(
        (d) => d.decision_type === 'approve'
      ),
      has_prior_denials: context.recent_decisions.some((d) => d.decision_type === 'deny'),
    },
    enrichment_status: 'complete',
  };
}

/**
 * Filter memory relevant to task type
 */
function filterRelevantMemory(
  taskType: TaskType,
  context: AgentContext
): Record<string, unknown> {
  const memory: Record<string, unknown> = {};

  if (taskType.startsWith('coupon_')) {
    memory.coupon_decision_count = (context.recent_decisions || []).filter(
      (d) => d.task_id.includes('coupon')
    ).length;
    memory.avg_coupon_discount = context.learning_memory?.avg_coupon_discount;
  }

  if (taskType.startsWith('order_')) {
    memory.recent_order_volume = context.operational_memory?.recent_order_count;
    memory.avg_order_value = context.operational_memory?.avg_order_value;
  }

  if (taskType.startsWith('price_')) {
    memory.current_pricing_strategy = context.operational_memory?.pricing_strategy;
    memory.recent_price_changes = context.learning_memory?.price_changes;
  }

  return memory;
}

// ============================================================================
// AUTHORIZATION & PERMISSION CHECKS
// ============================================================================

/**
 * Check if task type is allowed for agent role & scope
 */
export function checkTaskPermission(
  taskType: TaskType,
  role: string,
  scope: string[]
): boolean {
  // CEO has full access
  if (role === 'ceo') {
    return true;
  }

  // Cron/Agents can only auto-execute whitelisted tasks
  if (role === 'cron' || role === 'agent') {
    return WHITELISTED_AUTO_EXECUTE.includes(taskType);
  }

  // API users have limited access
  if (role === 'api_user') {
    return WHITELISTED_AUTO_EXECUTE.includes(taskType) && !SENSITIVE_TASKS.includes(taskType);
  }

  // Webhook users - very restricted
  if (role === 'webhook') {
    return ['email_notify', 'order_mark_shipped'].includes(taskType);
  }

  return false;
}

// ============================================================================
// DECISION GATE: APPROVE, DENY, OR ESCALATE
// ============================================================================

/**
 * Make decision: auto-execute, escalate to CEO, or deny
 */
export function makeApplyDecision(
  task: AgentTask,
  enrichedContext: Record<string, unknown>,
  authResult: AuthorizationResult
): ApplyDecision {
  const { task_type } = task;
  const { authorized, role } = authResult;

  // Not authorized - automatic deny
  if (!authorized) {
    return {
      decision: 'deny',
      reason: 'Unauthorized source',
      task_id: task.id,
      proceed: false,
    };
  }

  // CEO can auto-approve everything
  if (role === 'ceo') {
    const auto_executable = WHITELISTED_AUTO_EXECUTE.includes(task_type);
    if (SENSITIVE_TASKS.includes(task_type)) {
      return {
        decision: 'approve',
        reason: 'CEO directive - sensitive task requires explicit approval',
        task_id: task.id,
        proceed: false,
        requires_approval: true,
        escalation_target: 'ceo_ui',
      };
    }
    return {
      decision: 'approve',
      reason: 'CEO directive - auto-executable',
      task_id: task.id,
      proceed: auto_executable,
      auto_executable,
    };
  }

  // Non-CEO: only whitelisted tasks
  if (!WHITELISTED_AUTO_EXECUTE.includes(task_type)) {
    return {
      decision: 'escalate',
      reason: `${task_type} requires CEO approval`,
      task_id: task.id,
      proceed: false,
      requires_approval: true,
      escalation_target: 'ceo_telegram',
    };
  }

  // Whitelisted task - approve for auto-execution
  return {
    decision: 'approve',
    reason: 'Task is whitelisted for auto-execution',
    task_id: task.id,
    proceed: true,
    auto_executable: true,
  };
}

// ============================================================================
// INTAKE WORKFLOW (Stages 1-2 combined)
// ============================================================================

/**
 * Complete intake workflow: directive → validated task → enriched context
 * Returns task + enrichment, or error
 */
export async function intakeDirective(
  directive: Directive,
  client: SupabaseClient,
  ceoUserId?: string
): Promise<{
  task: AgentTask | null;
  enriched: Record<string, unknown> | null;
  error?: string;
  decision?: ApplyDecision;
}> {
  try {
    // Stage 1: Validate source
    const authResult = await validateDirectiveSource(directive, client, ceoUserId);
    if (!authResult.authorized) {
      return {
        task: null,
        enriched: null,
        error: authResult.reason || 'Unauthorized',
      };
    }

    // Stage 1: Classify directive
    const classified = await classifyDirective(directive);
    if (!classified) {
      return {
        task: null,
        enriched: null,
        error: 'Failed to classify directive',
      };
    }

    // Stage 1: Check permission
    if (!checkTaskPermission(classified.task_type, authResult.role!, authResult.scope!)) {
      return {
        task: null,
        enriched: null,
        error: `Role "${authResult.role}" cannot execute ${classified.task_type}`,
      };
    }

    // Stage 1: Create task record
    const task = await createTaskRecord(classified, client);
    if (!task) {
      return {
        task: null,
        enriched: null,
        error: 'Failed to create task record',
      };
    }

    // Stage 2: Load context
    const context = await loadAgentContext('CHRO', client);

    // Stage 2: Enrich task with context
    const enriched = enrichTaskWithContext(task, context);

    // Make decision
    const decision = makeApplyDecision(task, enriched, authResult);

    return {
      task,
      enriched,
      decision,
    };
  } catch (error) {
    console.error('[apply-flow] Intake failed:', error);
    return {
      task: null,
      enriched: null,
      error: `Intake error: ${String(error)}`,
    };
  }
}

// ============================================================================
// HELPER: Update task status
// ============================================================================

/**
 * Update task status in database
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  client: SupabaseClient,
  resultData?: Record<string, unknown>,
  errorMessage?: string
): Promise<boolean> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'executing') {
    updates.started_at = new Date().toISOString();
  }

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
    if (resultData) updates.result_data = resultData;
  }

  if (status === 'failed') {
    updates.completed_at = new Date().toISOString();
    if (errorMessage) updates.error_message = errorMessage;
  }

  const { error } = await client
    .from('agent_tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) {
    console.error('[apply-flow] Failed to update task status:', error);
    return false;
  }

  return true;
}

// ============================================================================
// HELPER: Log decision to agent_decisions
// ============================================================================

/**
 * Record decision for audit trail & learning
 */
export async function recordDecision(
  taskId: string,
  decision: ApplyDecision,
  client: SupabaseClient
): Promise<boolean> {
  const { error } = await client.from('agent_decisions').insert({
    task_id: taskId,
    decision_type: decision.decision,
    reasoning: decision.reason,
    parameters: {
      auto_executable: decision.auto_executable,
      escalation_target: decision.escalation_target,
    },
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[apply-flow] Failed to record decision:', error);
    return false;
  }

  return true;
}
