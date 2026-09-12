/**
 * ARQ Master OS - Apply Flow Notifications & Response
 * Stage 6: Notifications, Telegram Alerts, and Response Formatting
 * 
 * Notifies CEO of task completion, formats responses,
 * and handles escalation flows.
 */

import { SupabaseClient } from 'jsfetch';
import {
  AgentTask,
  ExecutionResult,
  ApplyResponse,
  DecisionType,
} from './apply-flow-types.ts';

// ============================================================================
// NOTIFICATION TYPES & CHANNELS
// ============================================================================

interface NotificationPayload {
  channel: 'telegram' | 'email' | 'webhook' | 'ui';
  priority: 'low' | 'normal' | 'high' | 'critical';
  recipient?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// STAGE 6: NOTIFICATIONS & RESPONSE
// ============================================================================

/**
 * Notify CEO and other stakeholders of task completion
 * Decides which channels to use based on task type & outcome
 */
export async function notifyCompletion(
  task: AgentTask,
  result: ExecutionResult,
  client: SupabaseClient
): Promise<boolean> {
  try {
    // Determine notification strategy
    const shouldNotifyCEO = isCEONotificationWorthy(task, result);
    const shouldNotifySlack = isSlackWorthy(task, result);
    const shouldNotifyWebhook = task.input_data.webhook_url ? true : false;

    // Send notifications in parallel
    const notifications = [];

    if (shouldNotifyCEO) {
      notifications.push(notifyCEOTelegram(task, result, client));
    }

    if (shouldNotifySlack) {
      notifications.push(notifySlack(task, result, client));
    }

    if (shouldNotifyWebhook) {
      notifications.push(notifyWebhook(task, result));
    }

    // Log all notifications to database
    notifications.push(logNotification(task, result, client));

    await Promise.all(notifications);

    return true;
  } catch (error) {
    console.error('[apply-flow-notify] Notification error:', error);
    return false;
  }
}

// ============================================================================
// CEO TELEGRAM NOTIFICATIONS
// ============================================================================

/**
 * Determine if CEO should be notified via Telegram
 */
function isCEONotificationWorthy(task: AgentTask, result: ExecutionResult): boolean {
  // Always notify on failure
  if (!result.success) return true;

  // Notify for sensitive/high-impact operations
  const highImpactTasks = [
    'price_change',
    'supplier_switch',
    'deploy_code',
    'export_data',
    'cancel_payment',
  ];

  if (highImpactTasks.includes(task.task_type)) {
    return true;
  }

  // Notify if execution took too long
  if (result.execution_time_ms > 5000) {
    return true;
  }

  // Notify if multiple retries needed
  if (result.retry_count > 1) {
    return true;
  }

  return false;
}

/**
 * Send Telegram notification to CEO
 */
async function notifyCEOTelegram(
  task: AgentTask,
  result: ExecutionResult,
  client: SupabaseClient
): Promise<void> {
  const message = buildTelegramMessage(task, result);

  // Get CEO's telegram ID from config (stored in agent_config)
  const { data: config } = await client
    .from('agent_config')
    .select('settings')
    .eq('agent_type', 'CHRO')
    .single();

  const telegramBotId = config?.settings?.telegram_bot_id;
  const telegramChatId = config?.settings?.telegram_chat_id;

  if (!telegramBotId || !telegramChatId) {
    console.warn('[apply-flow-notify] Telegram config missing');
    return;
  }

  // Send via telegram-notify edge function or direct API
  try {
    const response = await fetch('https://api.telegram.org/bot' + telegramBotId + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message.text,
        parse_mode: 'HTML',
        reply_markup: message.reply_markup || undefined,
      }),
    });

    if (!response.ok) {
      console.error('[apply-flow-notify] Telegram send failed:', await response.text());
    }
  } catch (error) {
    console.error('[apply-flow-notify] Telegram error:', error);
  }
}

/**
 * Build Telegram message format
 */
function buildTelegramMessage(
  task: AgentTask,
  result: ExecutionResult
): {
  text: string;
  reply_markup?: Record<string, unknown>;
} {
  const { task_type, input_data } = task;
  const { success, execution_time_ms, error } = result;

  const icon = success ? '✅' : '❌';
  const statusText = success ? 'Completed' : 'Failed';
  const timeText = `${execution_time_ms}ms`;

  let title = `${icon} <b>${task_type}</b> ${statusText}`;

  let details = '';

  switch (task_type) {
    case 'coupon_create':
      details = `Code: <code>${input_data.code}</code>\nDiscount: $${input_data.discount_value}`;
      break;

    case 'order_mark_shipped':
      details = `Order: <code>${input_data.order_id}</code>`;
      break;

    case 'price_change':
      details = `Product: <code>${input_data.product_id}</code>\nNew price: $${input_data.new_price}`;
      break;

    case 'deploy_code':
      details = `Branch: ${input_data.branch || 'main'}\nCommit: ${String(input_data.commit).substring(0, 7)}`;
      break;
  }

  const errorText = error ? `\n⚠️ <code>${error}</code>` : '';

  const text = `${title}
${details}
⏱️ ${timeText}${errorText}

Updated: ${new Date().toLocaleTimeString()}`;

  // Add action buttons for escalated tasks
  const reply_markup =
    !success && task_type !== 'custom_action'
      ? {
          inline_keyboard: [
            [
              { text: 'Retry', callback_data: `retry_${task.id}` },
              { text: 'View Details', callback_data: `details_${task.id}` },
            ],
          ],
        }
      : undefined;

  return { text, reply_markup };
}

// ============================================================================
// SLACK NOTIFICATIONS
// ============================================================================

/**
 * Determine if Slack should be notified
 */
function isSlackWorthy(task: AgentTask, result: ExecutionResult): boolean {
  // Notify on failure
  if (!result.success) return true;

  // Notify for certain task types (reporting, research)
  if (['generate_report', 'research_trend'].includes(task.task_type)) {
    return true;
  }

  return false;
}

/**
 * Send Slack notification
 */
async function notifySlack(
  task: AgentTask,
  result: ExecutionResult,
  client: SupabaseClient
): Promise<void> {
  const message = buildSlackMessage(task, result);

  // Get Slack webhook from config
  const { data: config } = await client
    .from('agent_config')
    .select('settings')
    .eq('agent_type', 'CHRO')
    .single();

  const slackWebhook = config?.settings?.slack_webhook_url;

  if (!slackWebhook) {
    console.warn('[apply-flow-notify] Slack webhook not configured');
    return;
  }

  try {
    const response = await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[apply-flow-notify] Slack send failed:', await response.text());
    }
  } catch (error) {
    console.error('[apply-flow-notify] Slack error:', error);
  }
}

/**
 * Build Slack message format
 */
function buildSlackMessage(
  task: AgentTask,
  result: ExecutionResult
): Record<string, unknown> {
  const { task_type, input_data, id: task_id } = task;
  const { success, execution_time_ms, error } = result;

  const color = success ? '#36a64f' : '#f44336';
  const statusText = success ? 'Completed' : 'Failed';

  let description = '';
  switch (task_type) {
    case 'generate_report':
      description = `Report type: ${input_data.report_type}`;
      break;
    case 'research_trend':
      description = `Research category: ${input_data.category}`;
      break;
    default:
      description = `Task ID: ${task_id.substring(0, 8)}`;
  }

  return {
    attachments: [
      {
        color,
        title: `${task_type} - ${statusText}`,
        text: description,
        fields: [
          {
            title: 'Execution Time',
            value: `${execution_time_ms}ms`,
            short: true,
          },
          {
            title: 'Task ID',
            value: task_id.substring(0, 12),
            short: true,
          },
        ],
        ts: Math.floor(Date.now() / 1000),
        footer: 'ARQ Master OS',
        footer_icon: 'https://arprimemarket.shop/logo.png',
      },
    ],
  };
}

// ============================================================================
// WEBHOOK NOTIFICATIONS
// ============================================================================

/**
 * Notify external webhook of task completion
 */
async function notifyWebhook(
  task: AgentTask,
  result: ExecutionResult
): Promise<void> {
  const webhookUrl = task.input_data.webhook_url;

  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return;
  }

  const payload = {
    event: 'task.completed',
    task_id: task.id,
    task_type: task.task_type,
    success: result.success,
    result: result.result_data,
    error: result.error,
    execution_time_ms: result.execution_time_ms,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error('[apply-flow-notify] Webhook error:', error);
  }
}

// ============================================================================
// NOTIFICATION LOGGING
// ============================================================================

/**
 * Log notification event to database
 */
async function logNotification(
  task: AgentTask,
  result: ExecutionResult,
  client: SupabaseClient
): Promise<void> {
  const { error } = await client.from('agent_notifications').insert({
    task_id: task.id,
    notification_type: result.success ? 'completion' : 'failure',
    channels: getNotificationChannels(task, result),
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[apply-flow-notify] Failed to log notification:', error);
  }
}

/**
 * Determine which channels were used for notification
 */
function getNotificationChannels(task: AgentTask, result: ExecutionResult): string[] {
  const channels = [];

  if (isCEONotificationWorthy(task, result)) {
    channels.push('telegram');
  }

  if (isSlackWorthy(task, result)) {
    channels.push('slack');
  }

  if (task.input_data.webhook_url) {
    channels.push('webhook');
  }

  return channels;
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

/**
 * Format complete apply response
 */
export function formatApplyResponse(
  task: AgentTask,
  result: ExecutionResult,
  decision: DecisionType
): ApplyResponse {
  const executionTime = result.execution_time_ms;
  const status = result.success ? 'complete' : 'error';

  return {
    status: status as 'complete' | 'pending_approval' | 'error',
    task_id: task.id,
    decision,
    result: result.result_data,
    error: result.success
      ? undefined
      : {
          code: 'EXECUTION_FAILED',
          message: result.error || 'Unknown error',
        },
    execution_time_ms: executionTime,
    memory_updated: result.success,
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(
  task: AgentTask | null,
  error: string,
  code: string = 'ERROR'
): ApplyResponse {
  return {
    status: 'error',
    task_id: task?.id || 'unknown',
    decision: 'deny',
    error: {
      code,
      message: error,
    },
    execution_time_ms: 0,
    memory_updated: false,
  };
}

/**
 * Format approval-pending response (CEO needs to approve)
 */
export function formatPendingApprovalResponse(
  task: AgentTask,
  reason: string
): ApplyResponse {
  return {
    status: 'pending_approval',
    task_id: task.id,
    decision: 'escalate',
    requires_approval: true,
    next_action: 'Awaiting CEO approval via Telegram. Reply with \"Apply koro\" to proceed.',
    execution_time_ms: 0,
    memory_updated: false,
  };
}

// ============================================================================
// CEO APPROVAL FLOW
// ============================================================================

/**
 * Handle CEO approval of escalated task
 */
export async function handleCEOApproval(
  taskId: string,
  approved: boolean,
  client: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  try {
    // Load task
    const { data: task, error: loadError } = await client
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (loadError || !task) {
      return { success: false, message: 'Task not found' };
    }

    if (approved) {
      // Update status to pending (will be picked up by executor)
      const { error } = await client
        .from('agent_tasks')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        return { success: false, message: 'Failed to update task' };
      }

      return { success: true, message: 'Task approved. Execution starting.' };
    } else {
      // Deny task
      const { error } = await client
        .from('agent_tasks')
        .update({
          status: 'failed',
          error_message: 'Denied by CEO',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) {
        return { success: false, message: 'Failed to deny task' };
      }

      return { success: true, message: 'Task denied.' };
    }
  } catch (error) {
    console.error('[apply-flow-notify] Approval handling error:', error);
    return { success: false, message: String(error) };
  }
}
