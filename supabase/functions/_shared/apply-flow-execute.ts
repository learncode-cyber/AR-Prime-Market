/**
 * ARQ Master OS - Apply Flow Execution Engine
 * Stages 3-4: Pre-Execution Validation + Task Execution
 * 
 * Handles business logic validation, conflict detection,
 * and actual task execution with retry logic.
 */

import { SupabaseClient } from 'jsfetch';
import {
  AgentTask,
  ValidationResult,
  ValidationError,
  ErrorSeverity,
  ExecutionResult,
  TaskType,
  RATE_LIMITS,
  TIMEOUTS,
} from './apply-flow-types.ts';
import { updateTaskStatus, recordDecision } from './apply-flow-core.ts';

// ============================================================================
// STAGE 3: PRE-EXECUTION VALIDATION
// ============================================================================

/**
 * Comprehensive validation before task execution
 * Checks business logic, data completeness, conflicts
 */
export async function validateTaskPreExecution(
  task: AgentTask,
  client: SupabaseClient
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const autoFixed: Record<string, unknown> = {};

  // Dispatch to task-specific validator
  switch (task.task_type) {
    case 'coupon_create':
    case 'coupon_update':
      validateCoupon(task, errors, warnings, autoFixed);
      break;

    case 'order_mark_shipped':
    case 'order_process':
      await validateOrder(task, client, errors, warnings);
      break;

    case 'price_change':
      await validatePriceChange(task, client, errors, warnings);
      break;

    case 'export_data':
      validateDataExport(task, errors, warnings);
      break;

    case 'email_notify':
      validateEmailNotification(task, errors, warnings);
      break;

    default:
      // Custom actions: minimal validation
      validateBasicFields(task.input_data, errors);
  }

  // Summary
  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    auto_fixed: Object.keys(autoFixed).length > 0 ? autoFixed : undefined,
  };
}

// ============================================================================
// COUPON VALIDATION
// ============================================================================

function validateCoupon(
  task: AgentTask,
  errors: ValidationError[],
  warnings: ValidationError[],
  autoFixed: Record<string, unknown>
) {
  const {
    input_data: { code, discount_value, discount_currency, min_order_amount },
  } = task;

  // Required fields
  if (!code || typeof code !== 'string') {
    errors.push({
      field: 'code',
      message: 'Coupon code required (string)',
      severity: 'error',
    });
  }

  if (!discount_value || typeof discount_value !== 'number') {
    errors.push({
      field: 'discount_value',
      message: 'Discount value required (number)',
      severity: 'error',
    });
  }

  if (!discount_currency) {
    errors.push({
      field: 'discount_currency',
      message: 'Discount currency required for fixed-amount coupons',
      severity: 'error',
    });
  }

  // Discount value validation
  if (typeof discount_value === 'number') {
    if (discount_value < 0) {
      errors.push({
        field: 'discount_value',
        message: 'Discount cannot be negative',
        severity: 'error',
        auto_fixable: true,
      });
      autoFixed.discount_value = Math.abs(discount_value);
    }

    if (discount_value > 50) {
      warnings.push({
        field: 'discount_value',
        message: 'Discount exceeds 50% - verify intentional',
        severity: 'warning',
      });
    }
  }

  // Currency validation
  const validCurrencies = ['USD', 'BDT', 'GBP', 'EUR', 'CAD', 'AUD', 'AED'];
  if (discount_currency && !validCurrencies.includes(String(discount_currency).toUpperCase())) {
    errors.push({
      field: 'discount_currency',
      message: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`,
      severity: 'error',
    });
  }

  // Min order validation
  if (min_order_amount && typeof min_order_amount === 'number') {
    if (min_order_amount < 5) {
      warnings.push({
        field: 'min_order_amount',
        message: 'Min order < $5 may be too low',
        severity: 'warning',
      });
    }

    if (min_order_amount < 0) {
      errors.push({
        field: 'min_order_amount',
        message: 'Min order cannot be negative',
        severity: 'error',
      });
    }
  }

  // Code format validation
  if (code && typeof code === 'string') {
    if (code.length < 2 || code.length > 50) {
      errors.push({
        field: 'code',
        message: 'Code must be 2-50 characters',
        severity: 'error',
      });
    }
    if (!/^[A-Z0-9_-]+$/i.test(code)) {
      errors.push({
        field: 'code',
        message: 'Code must contain only alphanumeric, dash, underscore',
        severity: 'error',
      });
    }
  }
}

// ============================================================================
// ORDER VALIDATION
// ============================================================================

async function validateOrder(
  task: AgentTask,
  client: SupabaseClient,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  const {
    input_data: { order_id },
  } = task;

  if (!order_id) {
    errors.push({
      field: 'order_id',
      message: 'Order ID required',
      severity: 'error',
    });
    return;
  }

  // Check order exists
  const { data: order, error } = await client
    .from('orders')
    .select('id, status')
    .eq('id', order_id)
    .single();

  if (error || !order) {
    errors.push({
      field: 'order_id',
      message: `Order not found: ${order_id}`,
      severity: 'error',
    });
    return;
  }

  // Check order status
  if (order.status === 'shipped') {
    warnings.push({
      field: 'order_id',
      message: 'Order already marked as shipped',
      severity: 'warning',
    });
  }

  if (order.status === 'cancelled') {
    errors.push({
      field: 'order_id',
      message: 'Cannot update cancelled order',
      severity: 'error',
    });
  }
}

// ============================================================================
// PRICE CHANGE VALIDATION
// ============================================================================

async function validatePriceChange(
  task: AgentTask,
  client: SupabaseClient,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  const {
    input_data: { product_id, new_price },
  } = task;

  if (!product_id || !new_price) {
    errors.push({
      field: 'required_fields',
      message: 'Product ID and new price required',
      severity: 'error',
    });
    return;
  }

  // Check product exists
  const { data: product, error } = await client
    .from('products')
    .select('id, price')
    .eq('id', product_id)
    .single();

  if (error || !product) {
    errors.push({
      field: 'product_id',
      message: `Product not found: ${product_id}`,
      severity: 'error',
    });
    return;
  }

  // Price validation
  if (new_price <= 0) {
    errors.push({
      field: 'new_price',
      message: 'Price must be positive',
      severity: 'error',
    });
  }

  const priceChange = ((new_price - product.price) / product.price) * 100;
  if (Math.abs(priceChange) > 50) {
    warnings.push({
      field: 'new_price',
      message: `Large price change (${priceChange.toFixed(1)}%) - verify intentional`,
      severity: 'warning',
    });
  }
}

// ============================================================================
// DATA EXPORT VALIDATION
// ============================================================================

function validateDataExport(
  task: AgentTask,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  const {
    input_data: { export_type, include_pii },
  } = task;

  if (!export_type) {
    errors.push({
      field: 'export_type',
      message: 'Export type required (customers, orders, products, etc.)',
      severity: 'error',
    });
  }

  if (include_pii) {
    warnings.push({
      field: 'include_pii',
      message: 'Exporting PII - ensure GDPR compliance',
      severity: 'warning',
    });
  }
}

// ============================================================================
// EMAIL NOTIFICATION VALIDATION
// ============================================================================

function validateEmailNotification(
  task: AgentTask,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  const {
    input_data: { recipient, subject, template },
  } = task;

  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipient))) {
    errors.push({
      field: 'recipient',
      message: 'Valid email address required',
      severity: 'error',
    });
  }

  if (!subject || String(subject).length < 3) {
    errors.push({
      field: 'subject',
      message: 'Email subject required',
      severity: 'error',
    });
  }

  if (!template) {
    errors.push({
      field: 'template',
      message: 'Email template required',
      severity: 'error',
    });
  }
}

// ============================================================================
// BASIC VALIDATION
// ============================================================================

function validateBasicFields(
  inputData: Record<string, unknown>,
  errors: ValidationError[]
) {
  if (!inputData || Object.keys(inputData).length === 0) {
    errors.push({
      field: 'input_data',
      message: 'Task input data required',
      severity: 'error',
    });
  }
}

// ============================================================================
// STAGE 4: TASK EXECUTION
// ============================================================================

/**
 * Execute task with retry logic and error handling
 */
export async function executeTask(
  task: AgentTask,
  client: SupabaseClient,
  retryCount: number = 0
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const maxRetries = RATE_LIMITS.retry_max_attempts;
  const backoffMs = RATE_LIMITS.retry_backoff_ms;

  try {
    // Update status to executing
    await updateTaskStatus(task.id, 'executing', client);

    let result: Record<string, unknown> | null = null;

    // Dispatch to task-specific executor
    switch (task.task_type) {
      case 'coupon_create':
        result = await executeCouponCreate(task, client);
        break;

      case 'coupon_update':
        result = await executeCouponUpdate(task, client);
        break;

      case 'order_mark_shipped':
        result = await executeOrderMarkShipped(task, client);
        break;

      case 'generate_report':
        result = await executeGenerateReport(task, client);
        break;

      case 'email_notify':
        result = await executeEmailNotification(task, client);
        break;

      default:
        result = { task_type: task.task_type, status: 'not_implemented' };
    }

    // Success
    const executionTime = Date.now() - startTime;
    await updateTaskStatus(task.id, 'completed', client, result);

    return {
      success: true,
      task_id: task.id,
      result_data: result || undefined,
      execution_time_ms: executionTime,
      retry_count: retryCount,
      memory_updated: true,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMsg = String(error);

    // Determine if retryable
    const isRetryable = isTransientError(errorMsg);
    const shouldRetry = isRetryable && retryCount < maxRetries;

    if (shouldRetry) {
      // Wait before retry
      const delay = backoffMs[retryCount] || 10000;
      console.log(`[apply-flow] Retry ${retryCount + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));

      // Recursive retry
      return executeTask(task, client, retryCount + 1);
    }

    // Failed permanently
    await updateTaskStatus(task.id, 'failed', client, undefined, errorMsg);

    return {
      success: false,
      task_id: task.id,
      error: errorMsg,
      execution_time_ms: executionTime,
      retry_count: retryCount,
      memory_updated: false,
    };
  }
}

// ============================================================================
// TASK EXECUTORS
// ============================================================================

async function executeCouponCreate(
  task: AgentTask,
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  const {
    code,
    discount_type = 'fixed',
    discount_value,
    discount_currency = 'USD',
    min_order_amount = 0,
    max_uses,
  } = task.input_data;

  // Check for duplicate
  const { data: existing } = await client
    .from('coupons')
    .select('id')
    .eq('code', code)
    .single();

  if (existing) {
    throw new Error(`Coupon code "${code}" already exists`);
  }

  // Insert coupon
  const { data, error } = await client
    .from('coupons')
    .insert({
      code,
      discount_type,
      discount_value,
      discount_currency,
      min_order_amount,
      max_uses: max_uses || null,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    coupon_id: data.id,
    code: data.code,
    created_at: data.created_at,
  };
}

async function executeCouponUpdate(
  task: AgentTask,
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  const { coupon_id, ...updates } = task.input_data;

  if (!coupon_id) {
    throw new Error('Coupon ID required for update');
  }

  const { data, error } = await client
    .from('coupons')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', coupon_id)
    .select()
    .single();

  if (error) throw error;

  return {
    coupon_id: data.id,
    updated_fields: Object.keys(updates),
  };
}

async function executeOrderMarkShipped(
  task: AgentTask,
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  const { order_id, tracking_number } = task.input_data;

  if (!order_id) {
    throw new Error('Order ID required');
  }

  const { data, error } = await client
    .from('orders')
    .update({
      status: 'shipped',
      tracking_number: tracking_number || null,
      shipped_at: new Date().toISOString(),
    })
    .eq('id', order_id)
    .select()
    .single();

  if (error) throw error;

  return {
    order_id: data.id,
    status: data.status,
    shipped_at: data.shipped_at,
  };
}

async function executeGenerateReport(
  task: AgentTask,
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  const { report_type = 'summary', period = '7d' } = task.input_data;

  // Generate report (simplified)
  const { data, error } = await client.rpc('generate_report', {
    p_type: report_type,
    p_period: period,
  });

  if (error) throw error;

  return {
    report_type,
    period,
    generated_at: new Date().toISOString(),
    data,
  };
}

async function executeEmailNotification(
  task: AgentTask,
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  const { recipient, subject, template, variables = {} } = task.input_data;

  // Call Resend or Supabase email function
  const { data, error } = await client.rpc('send_email', {
    p_to: recipient,
    p_subject: subject,
    p_template: template,
    p_variables: variables,
  });

  if (error) throw error;

  return {
    recipient,
    subject,
    sent_at: new Date().toISOString(),
  };
}

// ============================================================================
// HELPER: Determine if error is transient
// ============================================================================

function isTransientError(errorMsg: string): boolean {
  const transientPatterns = [
    'timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'rate limit',
    '429',
    '503',
    '502',
    'temporarily unavailable',
  ];

  return transientPatterns.some((p) => errorMsg.toLowerCase().includes(p.toLowerCase()));
}
