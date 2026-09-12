/**
 * ARQ Master OS - Apply Flow Type Definitions
 * Core data structures for agent task orchestration
 */

// ============================================================================
// DIRECTIVE & TASK TYPES
// ============================================================================

/**
 * Source of the directive (who initiated the task)
 */
export type DirectiveSource = 'ceo' | 'agent' | 'cron' | 'webhook' | 'api';

/**
 * Task status in the execution pipeline
 */
export type TaskStatus = 
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'pending_approval'
  | 'escalated'
  | 'retrying';

/**
 * Task priority level
 */
export type TaskPriority = 1 | 2 | 3 | 4 | 5; // 1=lowest, 5=critical

/**
 * Task type classification (operational category)
 */
export type TaskType = 
  | 'coupon_create'
  | 'coupon_update'
  | 'coupon_delete'
  | 'order_mark_shipped'
  | 'order_process'
  | 'email_notify'
  | 'generate_report'
  | 'research_trend'
  | 'price_change'
  | 'supplier_switch'
  | 'deploy_code'
  | 'export_data'
  | 'cancel_payment'
  | 'custom_action';

/**
 * Decision type after validation & business logic
 */
export type DecisionType = 'approve' | 'deny' | 'defer' | 'escalate';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'trivial' | 'warning' | 'error' | 'critical' | 'blocked';

// ============================================================================
// CORE DIRECTIVE STRUCTURE
// ============================================================================

/**
 * Raw directive input from CEO, agent, or cron
 */
export interface Directive {
  directive: string;                    // Human-readable task description
  source: DirectiveSource;              // Who initiated
  priority?: TaskPriority;              // Default: 3 (normal)
  context?: Record<string, unknown>;    // Optional metadata
  user_id?: string;                     // Authenticated user (for audit)
  request_id?: string;                  // For tracing
  deadline?: Date;                      // Optional: when must complete
}

/**
 * Parsed & classified directive (after intent classification)
 */
export interface ClassifiedDirective extends Directive {
  task_type: TaskType;
  entity: string;                       // What we're operating on (coupons, orders, etc.)
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'report';
  params: Record<string, unknown>;      // Structured parameters
}

// ============================================================================
// AGENT TASK RECORD (Database representation)
// ============================================================================

/**
 * Agent task as stored in agent_tasks table
 */
export interface AgentTask {
  id: string;                           // UUID
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  input_data: Record<string, unknown>;  // Structured input (JSONB)
  result_data?: Record<string, unknown>; // Output (JSONB)
  assigned_agent: string;               // Agent identifier (e.g., "CHRO")
  source: DirectiveSource;
  user_id?: string;
  request_id?: string;
  error_message?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

// ============================================================================
// AGENT MEMORY & CONTEXT
// ============================================================================

/**
 * Agent memory context types
 */
export type MemoryContextType = 'operational' | 'learning' | 'decision' | 'config';

/**
 * Agent memory record
 */
export interface AgentMemory {
  id: string;
  agent_id: string;                     // e.g., "CHRO"
  context_type: MemoryContextType;
  content: Record<string, unknown>;     // Arbitrary JSON
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Loaded agent context (memory + decision history)
 */
export interface AgentContext {
  agent_id: string;
  operational_memory: Record<string, unknown>;
  learning_memory: Record<string, unknown>;
  recent_decisions: AgentDecision[];
  config: Record<string, unknown>;
}

/**
 * Agent decision record
 */
export interface AgentDecision {
  id: string;
  task_id: string;
  decision_type: DecisionType;
  reasoning: string;
  parameters: Record<string, unknown>;
  created_at: Date;
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

/**
 * Result of authorization check
 */
export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  role?: string;
  scope?: string[];
}

/**
 * Result of business logic validation
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: ErrorSeverity;
  auto_fixable?: boolean;
}

/**
 * Result of pre-execution validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  auto_fixed?: Record<string, unknown>; // Auto-corrected values
}

// ============================================================================
// DECISION GATE OUTPUT
// ============================================================================

/**
 * Decision made by validation & business logic
 */
export interface ApplyDecision {
  decision: DecisionType;
  reason: string;
  task_id: string;
  proceed?: boolean;
  requires_approval?: boolean;
  escalation_target?: string;           // Who to escalate to
  auto_executable?: boolean;
}

// ============================================================================
// EXECUTION RESULT
// ============================================================================

/**
 * Result of task execution
 */
export interface ExecutionResult {
  success: boolean;
  task_id: string;
  result_data?: Record<string, unknown>;
  error?: string;
  execution_time_ms: number;
  retry_count: number;
  memory_updated: boolean;
}

// ============================================================================
// APPLY FLOW RESPONSE
// ============================================================================

/**
 * Complete response from apply() function
 */
export interface ApplyResponse {
  status: 'complete' | 'pending_approval' | 'error';
  task_id: string;
  decision: DecisionType;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  execution_time_ms: number;
  memory_updated: boolean;
  requires_approval?: boolean;
  next_action?: string;
}

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

/**
 * Whitelisted tasks that auto-execute (no CEO approval needed)
 */
export const WHITELISTED_AUTO_EXECUTE: TaskType[] = [
  'coupon_create',
  'coupon_update',
  'order_mark_shipped',
  'email_notify',
  'generate_report',
  'research_trend',
];

/**
 * Sensitive tasks that require CEO approval
 */
export const SENSITIVE_TASKS: TaskType[] = [
  'price_change',
  'supplier_switch',
  'deploy_code',
  'export_data',
  'cancel_payment',
];

/**
 * Task type to entity mapping
 */
export const TASK_TYPE_TO_ENTITY: Record<TaskType, string> = {
  coupon_create: 'coupons',
  coupon_update: 'coupons',
  coupon_delete: 'coupons',
  order_mark_shipped: 'orders',
  order_process: 'orders',
  email_notify: 'notifications',
  generate_report: 'reports',
  research_trend: 'research',
  price_change: 'products',
  supplier_switch: 'suppliers',
  deploy_code: 'deployments',
  export_data: 'exports',
  cancel_payment: 'payments',
  custom_action: 'custom',
};

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  auto_execute_per_minute: 100,
  escalated_per_minute: 10,
  research_per_hour: 50,
  retry_max_attempts: 3,
  retry_backoff_ms: [2000, 5000, 10000], // 2s, 5s, 10s
  circuit_breaker_threshold: 5,          // failures before disable
  circuit_breaker_duration_ms: 3600000,  // 1 hour
};

/**
 * Timeout configurations (in seconds)
 */
export const TIMEOUTS = {
  validation: 5,
  execution: 30,
  escalation_wait: 300, // 5 minutes for CEO approval
  memory_load: 3,
};
