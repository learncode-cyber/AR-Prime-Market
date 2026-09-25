/**
 * Module 24 Phase 1: Performance Monitoring & Instrumentation
 * 
 * Purpose: Collect baseline metrics for ARQ Master OS "Apply" Flow
 * Goals:
 *   - Instrument all 6 stages with timing
 *   - Establish baseline metrics
 *   - Identify bottlenecks
 *   - Set optimization targets
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// PERFORMANCE MONITORING TYPES
// ============================================================================

export interface PerformanceMetric {
  stage_name: string;
  execution_time_ms: number;
  task_type: string;
  success: boolean;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface StageTiming {
  stage_1_intake_ms: number;
  stage_2_context_ms: number;
  stage_3_validation_ms: number;
  stage_4_execution_ms: number;
  stage_5_memory_ms: number;
  stage_6_notification_ms: number;
  total_ms: number;
}

export interface PerformanceBaseline {
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  date_range: {
    start: Date;
    end: Date;
  };
  metrics: {
    stage_1: StageMetrics;
    stage_2: StageMetrics;
    stage_3: StageMetrics;
    stage_4: StageMetrics;
    stage_5: StageMetrics;
    stage_6: StageMetrics;
    total: StageMetrics;
  };
  bottlenecks: BottleneckAnalysis[];
  recommendations: string[];
}

export interface StageMetrics {
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
  total_time_ms: number;
  count: number;
}

export interface BottleneckAnalysis {
  stage: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class PerformanceMonitor {
  private supabase: any;
  private metrics: PerformanceMetric[] = [];
  private stageLogs: Map<string, number[]> = new Map();

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
    this.initializeStageLogs();
  }

  private initializeStageLogs(): void {
    const stages = [
      'stage_1_intake',
      'stage_2_context',
      'stage_3_validation',
      'stage_4_execution',
      'stage_5_memory',
      'stage_6_notification',
    ];

    stages.forEach(stage => {
      this.stageLogs.set(stage, []);
    });
  }

  /**
   * Measure stage execution time
   */
  async measureStage<T>(
    stageName: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration_ms: number }> {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      // Record timing
      const stageLogs = this.stageLogs.get(stageName) || [];
      stageLogs.push(duration);
      this.stageLogs.set(stageName, stageLogs);

      // Log to database
      await this.logMetric({
        stage_name: stageName,
        execution_time_ms: Math.round(duration),
        task_type: metadata?.task_type || 'unknown',
        success: true,
        timestamp: new Date(),
        metadata,
      });

      return { result, duration_ms: Math.round(duration) };
    } catch (error) {
      const duration = performance.now() - start;

      // Record error
      await this.logMetric({
        stage_name: stageName,
        execution_time_ms: Math.round(duration),
        task_type: metadata?.task_type || 'unknown',
        success: false,
        error: String(error),
        timestamp: new Date(),
        metadata,
      });

      throw error;
    }
  }

  /**
   * Log metric to database
   */
  private async logMetric(metric: PerformanceMetric): Promise<void> {
    try {
      await this.supabase
        .from('performance_metrics')
        .insert([
          {
            stage_name: metric.stage_name,
            execution_time_ms: metric.execution_time_ms,
            task_type: metric.task_type,
            success: metric.success,
            error_message: metric.error,
            metadata: metric.metadata,
            created_at: metric.timestamp.toISOString(),
          },
        ]);

      this.metrics.push(metric);
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to log metric:', error);
    }
  }

  /**
   * Get metrics for a stage
   */
  getStageMetrics(stageName: string): StageMetrics {
    const logs = this.stageLogs.get(stageName) || [];
    if (logs.length === 0) {
      return {
        avg_ms: 0,
        p50_ms: 0,
        p95_ms: 0,
        p99_ms: 0,
        min_ms: 0,
        max_ms: 0,
        total_time_ms: 0,
        count: 0,
      };
    }

    const sorted = [...logs].sort((a, b) => a - b);
    const total = sorted.reduce((sum, val) => sum + val, 0);

    return {
      avg_ms: Math.round(total / sorted.length),
      p50_ms: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
      p95_ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
      p99_ms: Math.round(sorted[Math.floor(sorted.length * 0.99)]),
      min_ms: Math.round(Math.min(...sorted)),
      max_ms: Math.round(Math.max(...sorted)),
      total_time_ms: Math.round(total),
      count: sorted.length,
    };
  }

  /**
   * Generate baseline report
   */
  async generateBaseline(): Promise<PerformanceBaseline> {
    const stages = [
      'stage_1_intake',
      'stage_2_context',
      'stage_3_validation',
      'stage_4_execution',
      'stage_5_memory',
      'stage_6_notification',
    ];

    // Calculate total
    const totalMetrics: number[] = [];
    stages.forEach(stage => {
      const logs = this.stageLogs.get(stage) || [];
      totalMetrics.push(...logs);
    });

    // Analyze metrics
    const metrics: Record<string, StageMetrics> = {};
    stages.forEach(stage => {
      metrics[stage] = this.getStageMetrics(stage);
    });

    const sortedTotal = [...totalMetrics].sort((a, b) => a - b);
    metrics['total'] = {
      avg_ms: sortedTotal.length > 0
        ? Math.round(sortedTotal.reduce((a, b) => a + b, 0) / sortedTotal.length)
        : 0,
      p50_ms: sortedTotal.length > 0 ? Math.round(sortedTotal[Math.floor(sortedTotal.length * 0.5)]) : 0,
      p95_ms: sortedTotal.length > 0 ? Math.round(sortedTotal[Math.floor(sortedTotal.length * 0.95)]) : 0,
      p99_ms: sortedTotal.length > 0 ? Math.round(sortedTotal[Math.floor(sortedTotal.length * 0.99)]) : 0,
      min_ms: sortedTotal.length > 0 ? Math.round(Math.min(...sortedTotal)) : 0,
      max_ms: sortedTotal.length > 0 ? Math.round(Math.max(...sortedTotal)) : 0,
      total_time_ms: sortedTotal.length > 0 ? Math.round(sortedTotal.reduce((a, b) => a + b, 0)) : 0,
      count: sortedTotal.length,
    };

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, bottlenecks);

    // Count task results
    const successCount = this.metrics.filter(m => m.success).length;
    const failureCount = this.metrics.filter(m => !m.success).length;

    return {
      total_tasks: this.metrics.length,
      successful_tasks: successCount,
      failed_tasks: failureCount,
      date_range: {
        start: new Date(Math.min(...this.metrics.map(m => m.timestamp.getTime()))),
        end: new Date(Math.max(...this.metrics.map(m => m.timestamp.getTime()))),
      },
      metrics,
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: Record<string, StageMetrics>): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = [];
    const total = metrics['total'].avg_ms;

    const thresholds = {
      high: total * 0.3,    // 30% of total
      medium: total * 0.15, // 15% of total
      low: total * 0.05,    // 5% of total
    };

    // Analyze each stage
    Object.entries(metrics).forEach(([stage, stageMetrics]) => {
      if (stage === 'total') return;

      const percentage = (stageMetrics.avg_ms / total) * 100;

      if (stageMetrics.avg_ms > thresholds.high) {
        bottlenecks.push({
          stage,
          reason: `Stage taking ${percentage.toFixed(1)}% of total time (${stageMetrics.avg_ms}ms)`,
          impact: 'high',
          recommendation: this.getBottleneckRecommendation(stage, stageMetrics),
        });
      } else if (stageMetrics.avg_ms > thresholds.medium) {
        bottlenecks.push({
          stage,
          reason: `Stage taking ${percentage.toFixed(1)}% of total time (${stageMetrics.avg_ms}ms)`,
          impact: 'medium',
          recommendation: this.getBottleneckRecommendation(stage, stageMetrics),
        });
      }
    });

    return bottlenecks.sort((a, b) =>
      a.impact === 'high' ? -1 : b.impact === 'high' ? 1 : 0
    );
  }

  /**
   * Generate bottleneck-specific recommendations
   */
  private getBottleneckRecommendation(stage: string, metrics: StageMetrics): string {
    const variance = metrics.p99_ms - metrics.p50_ms;
    const hasHighVariance = variance > metrics.p50_ms * 0.5;

    switch (stage) {
      case 'stage_1_intake':
        return hasHighVariance
          ? 'High variance in intake time. Investigate auth system or classification logic.'
          : 'Consider caching intent classification results.';

      case 'stage_2_context':
        return 'Optimize memory queries. Add caching for frequent context types.';

      case 'stage_3_validation':
        return 'Review validator complexity. Consider parallel validation.';

      case 'stage_4_execution':
        return 'Profile execution functions. Check for slow external API calls.';

      case 'stage_5_memory':
        return 'Optimize memory updates. Batch writes where possible.';

      case 'stage_6_notification':
        return 'Make notifications async. Move to background job.';

      default:
        return 'Investigate performance characteristics.';
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    metrics: Record<string, StageMetrics>,
    bottlenecks: BottleneckAnalysis[]
  ): string[] {
    const recommendations: string[] = [];

    // P95 latency
    const p95Total = metrics['total'].p95_ms;
    if (p95Total > 1000) {
      recommendations.push(`P95 latency is ${p95Total}ms (target: <1000ms). Implement caching layer.`);
    }

    // Stage-specific
    if (metrics['stage_2_context'].avg_ms > 100) {
      recommendations.push('Context loading is slow. Cache operational memory with 5-10s TTL.');
    }

    if (metrics['stage_4_execution'].avg_ms > 300) {
      recommendations.push('Task execution is slow. Profile for slow external calls or queries.');
    }

    // Bottleneck count
    if (bottlenecks.filter(b => b.impact === 'high').length > 2) {
      recommendations.push('Multiple high-impact bottlenecks. Prioritize optimization based on impact.');
    }

    // Database queries
    recommendations.push('Audit database query performance. Add indexes for frequently used queries.');
    recommendations.push('Implement query result caching for frequently accessed data.');

    // Memory
    if (metrics['total'].count > 100) {
      recommendations.push('After optimization, profile memory usage under sustained load.');
    }

    return recommendations;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const stages = [
      'stage_1_intake',
      'stage_2_context',
      'stage_3_validation',
      'stage_4_execution',
      'stage_5_memory',
      'stage_6_notification',
    ];

    let csv = 'stage_name,avg_ms,p50_ms,p95_ms,p99_ms,min_ms,max_ms,count\n';

    stages.forEach(stage => {
      const metrics = this.getStageMetrics(stage);
      csv += `${stage},${metrics.avg_ms},${metrics.p50_ms},${metrics.p95_ms},${metrics.p99_ms},${metrics.min_ms},${metrics.max_ms},${metrics.count}\n`;
    });

    return csv;
  }
}

// ============================================================================
// BASELINE TEST RUNNER
// ============================================================================

export async function runPerformanceBaseline(
  supabaseUrl: string,
  serviceKey: string,
  taskCount: number = 100
): Promise<PerformanceBaseline> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const monitor = new PerformanceMonitor(supabase);

  console.log(`[Module 24 Phase 1] Running performance baseline with ${taskCount} tasks...`);
  console.log('');

  // Simulate task execution with monitoring
  for (let i = 0; i < taskCount; i++) {
    const taskType = ['coupon_create', 'price_change', 'report_gen'][i % 3];

    try {
      // Stage 1: Intake
      await monitor.measureStage('stage_1_intake', async () => {
        // Simulate authentication & classification
        return await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      }, { task_type: taskType });

      // Stage 2: Context
      await monitor.measureStage('stage_2_context', async () => {
        // Simulate memory loading
        return await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 15));
      }, { task_type: taskType });

      // Stage 3: Validation
      await monitor.measureStage('stage_3_validation', async () => {
        // Simulate validation
        return await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));
      }, { task_type: taskType });

      // Stage 4: Execution
      await monitor.measureStage('stage_4_execution', async () => {
        // Simulate task execution
        return await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      }, { task_type: taskType });

      // Stage 5: Memory
      await monitor.measureStage('stage_5_memory', async () => {
        // Simulate memory updates
        return await new Promise(resolve => setTimeout(resolve, Math.random() * 25 + 10));
      }, { task_type: taskType });

      // Stage 6: Notification
      await monitor.measureStage('stage_6_notification', async () => {
        // Simulate notifications
        return await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
      }, { task_type: taskType });

      if ((i + 1) % 20 === 0) {
        console.log(`[Module 24] Processed ${i + 1}/${taskCount} tasks...`);
      }
    } catch (error) {
      console.error(`[Module 24] Task ${i + 1} failed:`, error);
    }
  }

  console.log('');
  console.log('[Module 24] Generating baseline report...');
  const baseline = await monitor.generateBaseline();

  return baseline;
}

// ============================================================================
// EXPORT BASELINE REPORT
// ============================================================================

export function formatBaselineReport(baseline: PerformanceBaseline): string {
  let report = `
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║     MODULE 24 PHASE 1: PERFORMANCE BASELINE REPORT                ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

📊 EXECUTION SUMMARY
════════════════════════════════════════════════════════════════════
  Total Tasks: ${baseline.total_tasks}
  Successful: ${baseline.successful_tasks} (${((baseline.successful_tasks / baseline.total_tasks) * 100).toFixed(1)}%)
  Failed: ${baseline.failed_tasks} (${((baseline.failed_tasks / baseline.total_tasks) * 100).toFixed(1)}%)
  Date Range: ${baseline.date_range.start.toISOString()} to ${baseline.date_range.end.toISOString()}

⏱️  OVERALL LATENCY
════════════════════════════════════════════════════════════════════
  Average: ${baseline.metrics.total.avg_ms}ms
  P50:     ${baseline.metrics.total.p50_ms}ms
  P95:     ${baseline.metrics.total.p95_ms}ms
  P99:     ${baseline.metrics.total.p99_ms}ms
  Min:     ${baseline.metrics.total.min_ms}ms
  Max:     ${baseline.metrics.total.max_ms}ms

📈 STAGE BREAKDOWN
════════════════════════════════════════════════════════════════════`;

  const stages = [
    { name: 'Stage 1: Intake', key: 'stage_1_intake' },
    { name: 'Stage 2: Context', key: 'stage_2_context' },
    { name: 'Stage 3: Validation', key: 'stage_3_validation' },
    { name: 'Stage 4: Execution', key: 'stage_4_execution' },
    { name: 'Stage 5: Memory', key: 'stage_5_memory' },
    { name: 'Stage 6: Notification', key: 'stage_6_notification' },
  ];

  stages.forEach(({ name, key }) => {
    const metrics = baseline.metrics[key];
    report += `
  
  ${name}
  ├─ Avg: ${metrics.avg_ms}ms | P95: ${metrics.p95_ms}ms | P99: ${metrics.p99_ms}ms
  └─ Range: ${metrics.min_ms}ms - ${metrics.max_ms}ms (${metrics.count} samples)`;
  });

  report += `

🚨 IDENTIFIED BOTTLENECKS
════════════════════════════════════════════════════════════════════`;

  if (baseline.bottlenecks.length === 0) {
    report += `
  ✅ No bottlenecks identified. Performance is balanced.`;
  } else {
    baseline.bottlenecks.forEach((bottleneck, idx) => {
      report += `

  ${idx + 1}. ${bottleneck.stage} [${bottleneck.impact.toUpperCase()}]
     Reason: ${bottleneck.reason}
     Fix: ${bottleneck.recommendation}`;
    });
  }

  report += `

💡 OPTIMIZATION RECOMMENDATIONS
════════════════════════════════════════════════════════════════════`;

  baseline.recommendations.forEach((rec, idx) => {
    report += `
  ${idx + 1}. ${rec}`;
  });

  report += `

════════════════════════════════════════════════════════════════════
Generated: ${new Date().toISOString()}
Status: BASELINE ESTABLISHED ✅
`;

  return report;
}
