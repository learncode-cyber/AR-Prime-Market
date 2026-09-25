// ═══════════════════════════════════════════════════════════════════════════
// Complete TypeScript Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════

// 🎯 Agent Types
export type AgentType = 
  | 'marketing' 
  | 'support' 
  | 'learning' 
  | 'inventory' 
  | 'financial' 
  | 'order' 
  | 'chro' 
  | 'orchestrator';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'approved' | 'rejected';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type CustomerSegment = 'new' | 'repeat' | 'vip' | 'at_risk' | 'inactive';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// 📊 Agent Core Interface
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  enabled: boolean;
  status: 'healthy' | 'warning' | 'error';
  last_heartbeat: Date;
  functions: string[];
  config: any;
}

// 🎯 Marketing Types
export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  reviews_count: number;
  reviews_rating: number;
  sales_velocity: number;
  created_at: Date;
}

export interface PriceStrategy {
  product_id: string;
  original_price: number;
  sale_price: number;
  discount_percent: number;
  scarcity_level: 'low' | 'medium' | 'high';
  social_proof_enabled: boolean;
  bundle_recommendation: string[];
  urgency_message: string;
  ab_test_variant: 'A' | 'B';
}

export interface MarketingCampaign {
  id: string;
  customer_id: string;
  segment_type: CustomerSegment;
  discount_percent: number;
  recommended_products: string[];
  expiry_days: number;
  created_at: Date;
  status: 'draft' | 'sent' | 'opened' | 'clicked' | 'converted';
}

// 💬 Support Types
export interface SupportTicket {
  id: string;
  customer_id: string;
  issue_type: string;
  priority: Priority;
  status: TaskStatus;
  assigned_to?: string;
  target_response_time: number;
  created_at: Date;
  resolved_at?: Date;
  resolution: string;
}

export interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  segment: CustomerSegment;
  lifetime_value: number;
  order_count: number;
  last_order_date?: Date;
  created_at: Date;
}

export interface PersonalizationProfile {
  customer_id: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  communication_channel: 'email' | 'sms' | 'telegram' | 'all';
  response_time_preference: 'asap' | 'within_24h' | 'within_48h';
  language: string;
  preferences: Record<string, any>;
}

// 🧠 Learning Types
export interface MLModel {
  id: string;
  name: string;
  type: 'demand_forecast' | 'trend_detection' | 'churn_prediction' | 'recommendation';
  accuracy: number;
  last_trained: Date;
  training_data_size: number;
}

export interface DemandForecast {
  product_id: string;
  forecast_date: Date;
  predicted_units: number;
  confidence: number;
  seasonal_factor: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MarketTrend {
  trend_id: string;
  category: string;
  trend_name: string;
  growth_rate: number;
  affected_products: string[];
  opportunity_score: number;
  created_at: Date;
}

// 📦 Inventory Types
export interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  reorder_point: number;
  lead_time_days: number;
  supplier_id: string;
  last_updated: Date;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  performance_score: number;
  reliability: number;
  quality: number;
  price_competitiveness: number;
  next_order_recommended: boolean;
}

// 💰 Financial Types
export interface FinancialMetrics {
  date: Date;
  total_revenue: number;
  total_costs: number;
  profit: number;
  profit_margin: number;
  roi: number;
  customer_acquisition_cost: number;
  customer_lifetime_value: number;
}

export interface Order {
  id: string;
  customer_id: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned';
  items: OrderItem[];
  created_at: Date;
  delivered_at?: Date;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
  discount_percent: number;
}

// 📊 Dashboard Types
export interface DashboardMetrics {
  revenue: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  conversions: {
    rate: number;
    trend: number;
  };
  customers: {
    total: number;
    new_today: number;
    retention_rate: number;
  };
  performance: {
    uptime: number;
    avg_response_time: number;
    error_rate: number;
  };
}

// 🎭 Orchestrator Types
export interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  parameters: Record<string, any>;
  status: TaskStatus;
  requires_approval: boolean;
  created_at: Date;
  completed_at?: Date;
  result?: any;
  error?: string;
}

export interface CEOApproval {
  id: string;
  task_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  requested_at: Date;
  responded_at?: Date;
  response_by?: string;
  modifications?: Record<string, any>;
}

// 🔄 Integration Types
export interface WebhookEvent {
  id: string;
  event_type: string;
  agent_id: string;
  payload: any;
  timestamp: Date;
  retry_count: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

