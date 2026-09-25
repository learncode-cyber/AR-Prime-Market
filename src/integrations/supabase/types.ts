export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          abandoned_at: string | null;
          cart: Json | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          abandoned_at?: string | null;
          cart?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          abandoned_at?: string | null;
          cart?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_accounts: {
        Row: {
          account_id: string;
          account_name: string | null;
          created_at: string;
          currency: string;
          id: string;
          is_active: boolean;
          platform: string;
        };
        Insert: {
          account_id: string;
          account_name?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          is_active?: boolean;
          platform: string;
        };
        Update: {
          account_id?: string;
          account_name?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          is_active?: boolean;
          platform?: string;
        };
        Relationships: [];
      };
      ad_automation_logs: {
        Row: {
          action: string;
          campaign_name: string | null;
          created_at: string;
          external_id: string | null;
          id: string;
          metrics: Json;
          payload: Json;
          platform: string;
          reason: string | null;
          success: boolean;
        };
        Insert: {
          action: string;
          campaign_name?: string | null;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          metrics?: Json;
          payload?: Json;
          platform: string;
          reason?: string | null;
          success?: boolean;
        };
        Update: {
          action?: string;
          campaign_name?: string | null;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          metrics?: Json;
          payload?: Json;
          platform?: string;
          reason?: string | null;
          success?: boolean;
        };
        Relationships: [];
      };
      ad_automation_settings: {
        Row: {
          ad_account_id: string | null;
          created_at: string;
          enabled: boolean;
          extra: Json;
          id: string;
          max_cpa: number;
          max_daily_budget: number;
          min_roas: number;
          monitor_window_hours: number;
          platform: string;
          scale_pct: number;
          scale_roas: number;
          updated_at: string;
        };
        Insert: {
          ad_account_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          extra?: Json;
          id?: string;
          max_cpa?: number;
          max_daily_budget?: number;
          min_roas?: number;
          monitor_window_hours?: number;
          platform: string;
          scale_pct?: number;
          scale_roas?: number;
          updated_at?: string;
        };
        Update: {
          ad_account_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          extra?: Json;
          id?: string;
          max_cpa?: number;
          max_daily_budget?: number;
          min_roas?: number;
          monitor_window_hours?: number;
          platform?: string;
          scale_pct?: number;
          scale_roas?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ad_campaigns: {
        Row: {
          ad_account_id: string | null;
          ai_created: boolean;
          ai_notes: string | null;
          clicks: number;
          conversions: number;
          cpa: number;
          cpc: number;
          created_at: string;
          ctr: number;
          daily_budget: number;
          id: string;
          impressions: number;
          name: string;
          objective: string;
          platform_campaign_id: string | null;
          product_ids: string[] | null;
          revenue: number;
          roas: number;
          status: string;
          target_audience: Json | null;
          total_spend: number;
          updated_at: string;
        };
        Insert: {
          ad_account_id?: string | null;
          ai_created?: boolean;
          ai_notes?: string | null;
          clicks?: number;
          conversions?: number;
          cpa?: number;
          cpc?: number;
          created_at?: string;
          ctr?: number;
          daily_budget?: number;
          id?: string;
          impressions?: number;
          name: string;
          objective: string;
          platform_campaign_id?: string | null;
          product_ids?: string[] | null;
          revenue?: number;
          roas?: number;
          status?: string;
          target_audience?: Json | null;
          total_spend?: number;
          updated_at?: string;
        };
        Update: {
          ad_account_id?: string | null;
          ai_created?: boolean;
          ai_notes?: string | null;
          clicks?: number;
          conversions?: number;
          cpa?: number;
          cpc?: number;
          created_at?: string;
          ctr?: number;
          daily_budget?: number;
          id?: string;
          impressions?: number;
          name?: string;
          objective?: string;
          platform_campaign_id?: string | null;
          product_ids?: string[] | null;
          revenue?: number;
          roas?: number;
          status?: string;
          target_audience?: Json | null;
          total_spend?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_ad_account_id_fkey";
            columns: ["ad_account_id"];
            isOneToOne: false;
            referencedRelation: "ad_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_performance_snapshots: {
        Row: {
          campaign_id: string;
          clicks: number;
          conversions: number;
          impressions: number;
          revenue: number;
          roas: number;
          snapshot_date: string;
          spend: number;
        };
        Insert: {
          campaign_id: string;
          clicks?: number;
          conversions?: number;
          impressions?: number;
          revenue?: number;
          roas?: number;
          snapshot_date: string;
          spend?: number;
        };
        Update: {
          campaign_id?: string;
          clicks?: number;
          conversions?: number;
          impressions?: number;
          revenue?: number;
          roas?: number;
          snapshot_date?: string;
          spend?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ad_performance_snapshots_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_scaling_state: {
        Row: {
          campaign_name: string | null;
          consecutive_wins: number;
          created_at: string;
          external_id: string;
          id: string;
          last_budget: number | null;
          last_cpa: number | null;
          last_roas: number | null;
          last_scaled_at: string | null;
          platform: string;
          total_scales: number;
          updated_at: string;
        };
        Insert: {
          campaign_name?: string | null;
          consecutive_wins?: number;
          created_at?: string;
          external_id: string;
          id?: string;
          last_budget?: number | null;
          last_cpa?: number | null;
          last_roas?: number | null;
          last_scaled_at?: string | null;
          platform: string;
          total_scales?: number;
          updated_at?: string;
        };
        Update: {
          campaign_name?: string | null;
          consecutive_wins?: number;
          created_at?: string;
          external_id?: string;
          id?: string;
          last_budget?: number | null;
          last_cpa?: number | null;
          last_roas?: number | null;
          last_scaled_at?: string | null;
          platform?: string;
          total_scales?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      affiliate_commissions: {
        Row: {
          affiliate_id: string;
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          metadata: Json | null;
          order_id: string | null;
          paid_at: string | null;
          status: string;
        };
        Insert: {
          affiliate_id: string;
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json | null;
          order_id?: string | null;
          paid_at?: string | null;
          status?: string;
        };
        Update: {
          affiliate_id?: string;
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json | null;
          order_id?: string | null;
          paid_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey";
            columns: ["affiliate_id"];
            isOneToOne: false;
            referencedRelation: "affiliates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      affiliates: {
        Row: {
          code: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string | null;
          payout_method: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          website: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          payout_method?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          website?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          payout_method?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_config: {
        Row: {
          description: string | null;
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      agent_decisions: {
        Row: {
          created_at: string;
          decision_type: string;
          execution_time_ms: number | null;
          id: string;
          input_data: Json;
          model_used: string | null;
          output_data: Json;
          reasoning: string;
          task_id: string | null;
          tokens_used: number | null;
        };
        Insert: {
          created_at?: string;
          decision_type: string;
          execution_time_ms?: number | null;
          id?: string;
          input_data?: Json;
          model_used?: string | null;
          output_data?: Json;
          reasoning: string;
          task_id?: string | null;
          tokens_used?: number | null;
        };
        Update: {
          created_at?: string;
          decision_type?: string;
          execution_time_ms?: number | null;
          id?: string;
          input_data?: Json;
          model_used?: string | null;
          output_data?: Json;
          reasoning?: string;
          task_id?: string | null;
          tokens_used?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_decisions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "agent_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_learning_logs: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          importance: number;
          is_locked: boolean;
          key: string;
          scope: string;
          source_agent: string | null;
          source_ref: string | null;
          tags: string[];
          updated_at: string;
          value: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          importance?: number;
          is_locked?: boolean;
          key: string;
          scope?: string;
          source_agent?: string | null;
          source_ref?: string | null;
          tags?: string[];
          updated_at?: string;
          value: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          importance?: number;
          is_locked?: boolean;
          key?: string;
          scope?: string;
          source_agent?: string | null;
          source_ref?: string | null;
          tags?: string[];
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      agent_memory: {
        Row: {
          confidence: number;
          id: string;
          key: string;
          last_updated: string;
          memory_type: string;
          source: string | null;
          value: Json;
        };
        Insert: {
          confidence?: number;
          id?: string;
          key: string;
          last_updated?: string;
          memory_type: string;
          source?: string | null;
          value: Json;
        };
        Update: {
          confidence?: number;
          id?: string;
          key?: string;
          last_updated?: string;
          memory_type?: string;
          source?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      agent_notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          task_id: string | null;
          title: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          task_id?: string | null;
          title: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          task_id?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_notifications_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "agent_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_proposals: {
        Row: {
          agent_slug: string;
          applied_at: string | null;
          created_at: string;
          decided_at: string | null;
          decision_note: string | null;
          id: string;
          payload: Json;
          payload_kind: string;
          plan_summary: string;
          requested_by: string | null;
          source: string;
          status: string;
          task: string;
          updated_at: string;
        };
        Insert: {
          agent_slug: string;
          applied_at?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          payload?: Json;
          payload_kind?: string;
          plan_summary: string;
          requested_by?: string | null;
          source?: string;
          status?: string;
          task: string;
          updated_at?: string;
        };
        Update: {
          agent_slug?: string;
          applied_at?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          payload?: Json;
          payload_kind?: string;
          plan_summary?: string;
          requested_by?: string | null;
          source?: string;
          status?: string;
          task?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_research_logs: {
        Row: {
          applied_count: number;
          category: string;
          created_at: string;
          id: string;
          key_takeaways: Json;
          model_used: string | null;
          source_query: string | null;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          applied_count?: number;
          category: string;
          created_at?: string;
          id?: string;
          key_takeaways?: Json;
          model_used?: string | null;
          source_query?: string | null;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          applied_count?: number;
          category?: string;
          created_at?: string;
          id?: string;
          key_takeaways?: Json;
          model_used?: string | null;
          source_query?: string | null;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_tasks: {
        Row: {
          admin_note: string | null;
          approved_at: string | null;
          approved_by: string | null;
          attempts: number;
          created_at: string;
          description: string;
          executed_at: string | null;
          expected_outcome: string;
          id: string;
          last_error: string | null;
          payload: Json;
          priority: string;
          reasoning: string;
          result: Json | null;
          scheduled_at: string | null;
          status: string;
          task_type: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          admin_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          attempts?: number;
          created_at?: string;
          description: string;
          executed_at?: string | null;
          expected_outcome: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          priority?: string;
          reasoning: string;
          result?: Json | null;
          scheduled_at?: string | null;
          status?: string;
          task_type: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          admin_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          attempts?: number;
          created_at?: string;
          description?: string;
          executed_at?: string | null;
          expected_outcome?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          priority?: string;
          reasoning?: string;
          result?: Json | null;
          scheduled_at?: string | null;
          status?: string;
          task_type?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_tasks_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_activity_log: {
        Row: {
          action: string | null;
          created_at: string | null;
          details: Json | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_activity_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_chat_messages: {
        Row: {
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parts: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "ai_chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_chat_threads: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_engine_logs: {
        Row: {
          completion_tokens: number | null;
          created_at: string | null;
          id: string;
          model_name: string | null;
          prompt_tokens: number | null;
          raw_response: Json | null;
          user_id: string | null;
        };
        Insert: {
          completion_tokens?: number | null;
          created_at?: string | null;
          id?: string;
          model_name?: string | null;
          prompt_tokens?: number | null;
          raw_response?: Json | null;
          user_id?: string | null;
        };
        Update: {
          completion_tokens?: number | null;
          created_at?: string | null;
          id?: string;
          model_name?: string | null;
          prompt_tokens?: number | null;
          raw_response?: Json | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ai_knowledge_updates: {
        Row: {
          applied_at: string | null;
          changes: Json | null;
          id: string;
          source: string | null;
        };
        Insert: {
          applied_at?: string | null;
          changes?: Json | null;
          id?: string;
          source?: string | null;
        };
        Update: {
          applied_at?: string | null;
          changes?: Json | null;
          id?: string;
          source?: string | null;
        };
        Relationships: [];
      };
      ai_learning_log: {
        Row: {
          created_at: string | null;
          id: string;
          metrics: Json | null;
          model_name: string | null;
          training_data: Json | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          metrics?: Json | null;
          model_name?: string | null;
          training_data?: Json | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          metrics?: Json | null;
          model_name?: string | null;
          training_data?: Json | null;
        };
        Relationships: [];
      };
      ai_marketing_strategies: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          name: string | null;
          parameters: Json | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string | null;
          parameters?: Json | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string | null;
          parameters?: Json | null;
        };
        Relationships: [];
      };
      ai_scan_results: {
        Row: {
          created_at: string | null;
          id: string;
          result: Json | null;
          source_id: string | null;
          source_type: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          result?: Json | null;
          source_id?: string | null;
          source_type?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          result?: Json | null;
          source_id?: string | null;
          source_type?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_scan_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_call_logs: {
        Row: {
          created_at: string | null;
          duration_ms: number | null;
          endpoint: string;
          id: string;
          ip_address: string | null;
          key_id: string | null;
          method: string;
          request_payload: Json | null;
          response_payload: Json | null;
          status_code: number | null;
        };
        Insert: {
          created_at?: string | null;
          duration_ms?: number | null;
          endpoint: string;
          id?: string;
          ip_address?: string | null;
          key_id?: string | null;
          method: string;
          request_payload?: Json | null;
          response_payload?: Json | null;
          status_code?: number | null;
        };
        Update: {
          created_at?: string | null;
          duration_ms?: number | null;
          endpoint?: string;
          id?: string;
          ip_address?: string | null;
          key_id?: string | null;
          method?: string;
          request_payload?: Json | null;
          response_payload?: Json | null;
          status_code?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "api_call_logs_key_id_fkey";
            columns: ["key_id"];
            isOneToOne: false;
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          },
        ];
      };
      api_credentials: {
        Row: {
          created_at: string | null;
          credentials: Json;
          id: string;
          is_active: boolean | null;
          label: string;
          provider: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          credentials?: Json;
          id?: string;
          is_active?: boolean | null;
          label: string;
          provider: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          credentials?: Json;
          id?: string;
          is_active?: boolean | null;
          label?: string;
          provider?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          id: string;
          key_hash: string;
          key_name: string;
          last_used_at: string | null;
          scopes: string[] | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash: string;
          key_name: string;
          last_used_at?: string | null;
          scopes?: string[] | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash?: string;
          key_name?: string;
          last_used_at?: string | null;
          scopes?: string[] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log_export_presets: {
        Row: {
          columns: string[];
          created_at: string;
          filters: Json;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          columns?: string[];
          created_at?: string;
          filters?: Json;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          columns?: string[];
          created_at?: string;
          filters?: Json;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      autonomous_staging: {
        Row: {
          consumed_at: string | null;
          consumed_by: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          importance: number;
          kind: string;
          payload: Json;
          ref_id: string | null;
          source: string | null;
          status: string;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          importance?: number;
          kind: string;
          payload?: Json;
          ref_id?: string | null;
          source?: string | null;
          status?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          importance?: number;
          kind?: string;
          payload?: Json;
          ref_id?: string | null;
          source?: string | null;
          status?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      blog_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      blog_comments: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          is_approved: boolean | null;
          parent_id: string | null;
          post_id: string | null;
          user_id: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          is_approved?: boolean | null;
          parent_id?: string | null;
          post_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          is_approved?: boolean | null;
          parent_id?: string | null;
          post_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "blog_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "blog_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blog_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blog_generation_logs: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          keyword: string | null;
          post_id: string | null;
          post_slug: string | null;
          post_title: string | null;
          status: string;
          triggered_by: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          keyword?: string | null;
          post_id?: string | null;
          post_slug?: string | null;
          post_title?: string | null;
          status: string;
          triggered_by?: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          keyword?: string | null;
          post_id?: string | null;
          post_slug?: string | null;
          post_title?: string | null;
          status?: string;
          triggered_by?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          author_id: string | null;
          author_name: string | null;
          category_id: string | null;
          content: string | null;
          created_at: string | null;
          excerpt: string | null;
          featured_image_url: string | null;
          id: string;
          is_published: boolean | null;
          meta_description: string | null;
          meta_title: string | null;
          published_at: string | null;
          seo_keywords: string[] | null;
          slug: string;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          author_name?: string | null;
          category_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image_url?: string | null;
          id?: string;
          is_published?: boolean | null;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          seo_keywords?: string[] | null;
          slug: string;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          author_name?: string | null;
          category_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image_url?: string | null;
          id?: string;
          is_published?: boolean | null;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          seo_keywords?: string[] | null;
          slug?: string;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "blog_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          created_at: string | null;
          description: string | null;
          end_at: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          slug: string;
          start_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          end_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          slug: string;
          start_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          end_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          slug?: string;
          start_at?: string | null;
        };
        Relationships: [];
      };
      cart_reminder_logs: {
        Row: {
          cart_id: string | null;
          channel: string | null;
          id: string;
          sent_at: string | null;
          success: boolean | null;
        };
        Insert: {
          cart_id?: string | null;
          channel?: string | null;
          id?: string;
          sent_at?: string | null;
          success?: boolean | null;
        };
        Update: {
          cart_id?: string | null;
          channel?: string | null;
          id?: string;
          sent_at?: string | null;
          success?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "cart_reminder_logs_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "abandoned_carts";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          parent_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          parent_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          parent_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      ceo_directives: {
        Row: {
          active: boolean;
          created_at: string;
          created_by_user_id: string | null;
          directive: string;
          id: string;
          importance: number;
          raw_message: string | null;
          source: string;
          tags: string[];
          topic: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by_user_id?: string | null;
          directive: string;
          id?: string;
          importance?: number;
          raw_message?: string | null;
          source?: string;
          tags?: string[];
          topic: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by_user_id?: string | null;
          directive?: string;
          id?: string;
          importance?: number;
          raw_message?: string | null;
          source?: string;
          tags?: string[];
          topic?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          created_at: string | null;
          id: string;
          message: string;
          metadata: Json | null;
          sender_id: string | null;
          session_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          message: string;
          metadata?: Json | null;
          sender_id?: string | null;
          session_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          message?: string;
          metadata?: Json | null;
          sender_id?: string | null;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_sessions: {
        Row: {
          created_at: string | null;
          id: string;
          status: string | null;
          subject: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          status?: string | null;
          subject?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          status?: string | null;
          subject?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cj_tokens: {
        Row: {
          access_token: string;
          created_at: string;
          expires_at: string;
          id: string;
          refresh_expires_at: string | null;
          refresh_token: string | null;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          refresh_expires_at?: string | null;
          refresh_token?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          refresh_expires_at?: string | null;
          refresh_token?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cj_webhook_events: {
        Row: {
          cj_pid: string | null;
          error_message: string | null;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          status: string;
        };
        Insert: {
          cj_pid?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
        };
        Update: {
          cj_pid?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      competitor_ad_intel: {
        Row: {
          ad_angle: string;
          created_at: string;
          creative_thumbnail_url: string | null;
          cta_url: string | null;
          engagement_level: string;
          hook_rate: number;
          hook_text: string;
          id: string;
          is_viral: boolean;
          metrics: Json;
          platform: string;
          product_ref: string;
          product_title: string;
          scanned_at: string;
        };
        Insert: {
          ad_angle: string;
          created_at?: string;
          creative_thumbnail_url?: string | null;
          cta_url?: string | null;
          engagement_level: string;
          hook_rate?: number;
          hook_text: string;
          id?: string;
          is_viral?: boolean;
          metrics?: Json;
          platform: string;
          product_ref: string;
          product_title: string;
          scanned_at?: string;
        };
        Update: {
          ad_angle?: string;
          created_at?: string;
          creative_thumbnail_url?: string | null;
          cta_url?: string | null;
          engagement_level?: string;
          hook_rate?: number;
          hook_text?: string;
          id?: string;
          is_viral?: boolean;
          metrics?: Json;
          platform?: string;
          product_ref?: string;
          product_title?: string;
          scanned_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          code: string | null;
          discount_type: string | null;
          discount_value: number | null;
          expires_at: string | null;
          id: string;
          is_active: boolean | null;
          min_order_amount: number | null;
        };
        Insert: {
          code?: string | null;
          discount_type?: string | null;
          discount_value?: number | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          min_order_amount?: number | null;
        };
        Update: {
          code?: string | null;
          discount_type?: string | null;
          discount_value?: number | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          min_order_amount?: number | null;
        };
        Relationships: [];
      };
      dynamic_ui_settings: {
        Row: {
          component_name: string;
          created_at: string;
          css_classes: string | null;
          custom_js: string | null;
          id: string;
          is_active: boolean;
          json_data: Json | null;
          prompt: string | null;
          updated_at: string;
        };
        Insert: {
          component_name: string;
          created_at?: string;
          css_classes?: string | null;
          custom_js?: string | null;
          id?: string;
          is_active?: boolean;
          json_data?: Json | null;
          prompt?: string | null;
          updated_at?: string;
        };
        Update: {
          component_name?: string;
          created_at?: string;
          css_classes?: string | null;
          custom_js?: string | null;
          id?: string;
          is_active?: boolean;
          json_data?: Json | null;
          prompt?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_logs: {
        Row: {
          body: string | null;
          id: string;
          last_error: string | null;
          max_retries: number;
          next_retry_at: string | null;
          retry_count: number;
          sent_at: string | null;
          status: string | null;
          subject: string | null;
          to_address: string | null;
        };
        Insert: {
          body?: string | null;
          id?: string;
          last_error?: string | null;
          max_retries?: number;
          next_retry_at?: string | null;
          retry_count?: number;
          sent_at?: string | null;
          status?: string | null;
          subject?: string | null;
          to_address?: string | null;
        };
        Update: {
          body?: string | null;
          id?: string;
          last_error?: string | null;
          max_retries?: number;
          next_retry_at?: string | null;
          retry_count?: number;
          sent_at?: string | null;
          status?: string | null;
          subject?: string | null;
          to_address?: string | null;
        };
        Relationships: [];
      };
      fake_order_events: {
        Row: {
          created_at: string;
          district: string | null;
          event_type: string;
          id: string;
          name: string | null;
          path: string | null;
          product_id: string | null;
          product_title: string | null;
          session_id: string | null;
        };
        Insert: {
          created_at?: string;
          district?: string | null;
          event_type: string;
          id?: string;
          name?: string | null;
          path?: string | null;
          product_id?: string | null;
          product_title?: string | null;
          session_id?: string | null;
        };
        Update: {
          created_at?: string;
          district?: string | null;
          event_type?: string;
          id?: string;
          name?: string | null;
          path?: string | null;
          product_id?: string | null;
          product_title?: string | null;
          session_id?: string | null;
        };
        Relationships: [];
      };
      fake_order_settings: {
        Row: {
          display_seconds: number;
          districts: string[];
          id: string;
          interval_seconds: number;
          is_enabled: boolean;
          names: string[];
          updated_at: string;
        };
        Insert: {
          display_seconds?: number;
          districts?: string[];
          id?: string;
          interval_seconds?: number;
          is_enabled?: boolean;
          names?: string[];
          updated_at?: string;
        };
        Update: {
          display_seconds?: number;
          districts?: string[];
          id?: string;
          interval_seconds?: number;
          is_enabled?: boolean;
          names?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      faq_categories: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      faq_items: {
        Row: {
          answer: string;
          category_id: string | null;
          created_at: string | null;
          id: string;
          question: string;
        };
        Insert: {
          answer: string;
          category_id?: string | null;
          created_at?: string | null;
          id?: string;
          question: string;
        };
        Update: {
          answer?: string;
          category_id?: string | null;
          created_at?: string | null;
          id?: string;
          question?: string;
        };
        Relationships: [
          {
            foreignKeyName: "faq_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "faq_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          category: string;
          description: string | null;
          is_enabled: boolean;
          key: string;
          label: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          description?: string | null;
          is_enabled?: boolean;
          key: string;
          label: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          description?: string | null;
          is_enabled?: boolean;
          key?: string;
          label?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fx_rates: {
        Row: {
          currency_code: string;
          rate_per_usd: number;
          updated_at: string;
        };
        Insert: {
          currency_code: string;
          rate_per_usd: number;
          updated_at?: string;
        };
        Update: {
          currency_code?: string;
          rate_per_usd?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      help_articles: {
        Row: {
          category_id: string | null;
          content: string | null;
          created_at: string | null;
          id: string;
          slug: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          category_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          slug: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          category_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          slug?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "help_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      help_categories: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      home_category_card_items: {
        Row: {
          card_id: string;
          created_at: string;
          id: string;
          image_url: string;
          label: string;
          position: number;
          search_query: string | null;
          target_slug: string | null;
        };
        Insert: {
          card_id: string;
          created_at?: string;
          id?: string;
          image_url: string;
          label: string;
          position?: number;
          search_query?: string | null;
          target_slug?: string | null;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          id?: string;
          image_url?: string;
          label?: string;
          position?: number;
          search_query?: string | null;
          target_slug?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "home_category_card_items_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "home_category_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      home_category_cards: {
        Row: {
          created_at: string;
          cta_label: string;
          id: string;
          is_active: boolean;
          position: number;
          target_slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cta_label?: string;
          id?: string;
          is_active?: boolean;
          position?: number;
          target_slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cta_label?: string;
          id?: string;
          is_active?: boolean;
          position?: number;
          target_slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_logs: {
        Row: {
          error_message: string | null;
          external_id: string | null;
          id: string;
          imported_at: string | null;
          input_url: string | null;
          product_id: string | null;
          source: string;
          status: string | null;
        };
        Insert: {
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          imported_at?: string | null;
          input_url?: string | null;
          product_id?: string | null;
          source: string;
          status?: string | null;
        };
        Update: {
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          imported_at?: string | null;
          input_url?: string | null;
          product_id?: string | null;
          source?: string;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_logs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_logs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
      imported_products: {
        Row: {
          category_id: string | null;
          category_name: string | null;
          cj_pid: string;
          created_at: string;
          id: string;
          imported_at: string;
          last_synced_at: string;
          product_description: string | null;
          product_image: string | null;
          product_name: string;
          product_name_en: string | null;
          product_status: number;
          sell_price: number | null;
          stock_info: Json;
          variants: Json;
        };
        Insert: {
          category_id?: string | null;
          category_name?: string | null;
          cj_pid: string;
          created_at?: string;
          id?: string;
          imported_at?: string;
          last_synced_at?: string;
          product_description?: string | null;
          product_image?: string | null;
          product_name: string;
          product_name_en?: string | null;
          product_status?: number;
          sell_price?: number | null;
          stock_info?: Json;
          variants?: Json;
        };
        Update: {
          category_id?: string | null;
          category_name?: string | null;
          cj_pid?: string;
          created_at?: string;
          id?: string;
          imported_at?: string;
          last_synced_at?: string;
          product_description?: string | null;
          product_image?: string | null;
          product_name?: string;
          product_name_en?: string | null;
          product_status?: number;
          sell_price?: number | null;
          stock_info?: Json;
          variants?: Json;
        };
        Relationships: [];
      };
      integration_secrets: {
        Row: {
          api_key: string;
          provider: string;
          updated_at: string;
        };
        Insert: {
          api_key: string;
          provider: string;
          updated_at?: string;
        };
        Update: {
          api_key?: string;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      integration_settings: {
        Row: {
          created_at: string;
          extra_config: Json | null;
          id: string;
          is_active: boolean;
          notes: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          extra_config?: Json | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          provider: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          extra_config?: Json | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_blasts: {
        Row: {
          agent_task_id: string | null;
          body: string;
          channel: string;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          failure_count: number;
          id: string;
          metadata: Json;
          recipient_count: number;
          status: string;
          subject: string | null;
          success_count: number;
          triggered_by: string | null;
        };
        Insert: {
          agent_task_id?: string | null;
          body: string;
          channel: string;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          failure_count?: number;
          id?: string;
          metadata?: Json;
          recipient_count?: number;
          status?: string;
          subject?: string | null;
          success_count?: number;
          triggered_by?: string | null;
        };
        Update: {
          agent_task_id?: string | null;
          body?: string;
          channel?: string;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          failure_count?: number;
          id?: string;
          metadata?: Json;
          recipient_count?: number;
          status?: string;
          subject?: string | null;
          success_count?: number;
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_blasts_agent_task_id_fkey";
            columns: ["agent_task_id"];
            isOneToOne: false;
            referencedRelation: "agent_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_campaigns: {
        Row: {
          ai_created: boolean;
          ai_reasoning: string | null;
          clicked: number;
          content: string;
          converted: number;
          created_at: string;
          delivered: number;
          id: string;
          name: string;
          opened: number;
          revenue_attributed: number;
          scheduled_at: string | null;
          sent_at: string | null;
          status: string;
          subject: string | null;
          target_segment: Json | null;
          total_recipients: number;
          type: string;
        };
        Insert: {
          ai_created?: boolean;
          ai_reasoning?: string | null;
          clicked?: number;
          content: string;
          converted?: number;
          created_at?: string;
          delivered?: number;
          id?: string;
          name: string;
          opened?: number;
          revenue_attributed?: number;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string | null;
          target_segment?: Json | null;
          total_recipients?: number;
          type: string;
        };
        Update: {
          ai_created?: boolean;
          ai_reasoning?: string | null;
          clicked?: number;
          content?: string;
          converted?: number;
          created_at?: string;
          delivered?: number;
          id?: string;
          name?: string;
          opened?: number;
          revenue_attributed?: number;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string | null;
          target_segment?: Json | null;
          total_recipients?: number;
          type?: string;
        };
        Relationships: [];
      };
      marketing_trackers: {
        Row: {
          id: string;
          is_active: boolean;
          provider: string;
          script_code: string | null;
          tracker_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          provider: string;
          script_code?: string | null;
          tracker_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          provider?: string;
          script_code?: string | null;
          tracker_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      mfa_recovery_codes: {
        Row: {
          code_hash: string;
          created_at: string;
          id: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          id?: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          id?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          cogs: number | null;
          created_at: string;
          id: string;
          image_url: string | null;
          order_id: string;
          product_id: string | null;
          product_title: string | null;
          quantity: number;
          supplier_product_id: string | null;
          supplier_variant_id: string | null;
          title: string;
          total_price: number | null;
          unit_price: number;
          variant_id: string | null;
          variant_label: string | null;
          variant_title: string | null;
        };
        Insert: {
          cogs?: number | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          order_id: string;
          product_id?: string | null;
          product_title?: string | null;
          quantity?: number;
          supplier_product_id?: string | null;
          supplier_variant_id?: string | null;
          title: string;
          total_price?: number | null;
          unit_price?: number;
          variant_id?: string | null;
          variant_label?: string | null;
          variant_title?: string | null;
        };
        Update: {
          cogs?: number | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          order_id?: string;
          product_id?: string | null;
          product_title?: string | null;
          quantity?: number;
          supplier_product_id?: string | null;
          supplier_variant_id?: string | null;
          title?: string;
          total_price?: number | null;
          unit_price?: number;
          variant_id?: string | null;
          variant_label?: string | null;
          variant_title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          admin_note: string | null;
          courier_consignment_id: string | null;
          created_at: string | null;
          currency: string | null;
          customer_country_code: string | null;
          customer_email: string | null;
          customer_name: string | null;
          customer_note: string | null;
          customer_phone: string | null;
          discount_amount: number | null;
          estimated_delivery: string | null;
          fulfillment_channel: string | null;
          fulfillment_status: string | null;
          guest_email: string | null;
          guest_token: string | null;
          id: string;
          order_number: string | null;
          payment_method: string | null;
          payment_status: string | null;
          shipping_address: string | null;
          shipping_city: string | null;
          shipping_country: string | null;
          shipping_country_name: string | null;
          shipping_fee: number | null;
          shipping_line1: string | null;
          shipping_line2: string | null;
          shipping_postal_code: string | null;
          shipping_state: string | null;
          status: Database["public"]["Enums"]["order_status"] | null;
          subtotal: number | null;
          supplier_order_id: string | null;
          total_amount: number;
          tracking_number: string | null;
          tracking_url: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          admin_note?: string | null;
          courier_consignment_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_country_code?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_note?: string | null;
          customer_phone?: string | null;
          discount_amount?: number | null;
          estimated_delivery?: string | null;
          fulfillment_channel?: string | null;
          fulfillment_status?: string | null;
          guest_email?: string | null;
          guest_token?: string | null;
          id?: string;
          order_number?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          shipping_address?: string | null;
          shipping_city?: string | null;
          shipping_country?: string | null;
          shipping_country_name?: string | null;
          shipping_fee?: number | null;
          shipping_line1?: string | null;
          shipping_line2?: string | null;
          shipping_postal_code?: string | null;
          shipping_state?: string | null;
          status?: Database["public"]["Enums"]["order_status"] | null;
          subtotal?: number | null;
          supplier_order_id?: string | null;
          total_amount?: number;
          tracking_number?: string | null;
          tracking_url?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          admin_note?: string | null;
          courier_consignment_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_country_code?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_note?: string | null;
          customer_phone?: string | null;
          discount_amount?: number | null;
          estimated_delivery?: string | null;
          fulfillment_channel?: string | null;
          fulfillment_status?: string | null;
          guest_email?: string | null;
          guest_token?: string | null;
          id?: string;
          order_number?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          shipping_address?: string | null;
          shipping_city?: string | null;
          shipping_country?: string | null;
          shipping_country_name?: string | null;
          shipping_fee?: number | null;
          shipping_line1?: string | null;
          shipping_line2?: string | null;
          shipping_postal_code?: string | null;
          shipping_state?: string | null;
          status?: Database["public"]["Enums"]["order_status"] | null;
          subtotal?: number | null;
          supplier_order_id?: string | null;
          total_amount?: number;
          tracking_number?: string | null;
          tracking_url?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          created_at: string;
          deposit_link: string | null;
          display_name: string;
          display_name_bn: string | null;
          icon_name: string | null;
          id: string;
          instructions: string | null;
          instructions_bn: string | null;
          is_active: boolean;
          method_key: string;
          sort_order: number;
          updated_at: string;
          wallet_address: string | null;
        };
        Insert: {
          created_at?: string;
          deposit_link?: string | null;
          display_name: string;
          display_name_bn?: string | null;
          icon_name?: string | null;
          id?: string;
          instructions?: string | null;
          instructions_bn?: string | null;
          is_active?: boolean;
          method_key: string;
          sort_order?: number;
          updated_at?: string;
          wallet_address?: string | null;
        };
        Update: {
          created_at?: string;
          deposit_link?: string | null;
          display_name?: string;
          display_name_bn?: string | null;
          icon_name?: string | null;
          id?: string;
          instructions?: string | null;
          instructions_bn?: string | null;
          is_active?: boolean;
          method_key?: string;
          sort_order?: number;
          updated_at?: string;
          wallet_address?: string | null;
        };
        Relationships: [];
      };
      pending_product_approvals: {
        Row: {
          approved_product_id: string | null;
          audit: Json | null;
          brief: Json | null;
          category_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          error_message: string | null;
          id: string;
          preview: Json;
          source_product_id: string;
          source_provider: string;
          source_url: string | null;
          status: Database["public"]["Enums"]["pending_approval_status"];
          suggested_markup_pct: number;
          telegram_chat_id: string | null;
          telegram_message_id: number | null;
          updated_at: string;
        };
        Insert: {
          approved_product_id?: string | null;
          audit?: Json | null;
          brief?: Json | null;
          category_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          error_message?: string | null;
          id?: string;
          preview: Json;
          source_product_id: string;
          source_provider?: string;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["pending_approval_status"];
          suggested_markup_pct?: number;
          telegram_chat_id?: string | null;
          telegram_message_id?: number | null;
          updated_at?: string;
        };
        Update: {
          approved_product_id?: string | null;
          audit?: Json | null;
          brief?: Json | null;
          category_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          error_message?: string | null;
          id?: string;
          preview?: Json;
          source_product_id?: string;
          source_provider?: string;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["pending_approval_status"];
          suggested_markup_pct?: number;
          telegram_chat_id?: string | null;
          telegram_message_id?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_product_approvals_approved_product_id_fkey";
            columns: ["approved_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_product_approvals_approved_product_id_fkey";
            columns: ["approved_product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_product_approvals_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string | null;
          id: string;
          is_primary: boolean | null;
          position: number | null;
          product_id: string | null;
          url: string;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean | null;
          position?: number | null;
          product_id?: string | null;
          url: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean | null;
          position?: number | null;
          product_id?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
      product_landing_copy: {
        Row: {
          created_at: string;
          faqs: Json;
          generated_by: string | null;
          headline: string;
          id: string;
          pain_points: Json;
          product_id: string;
          reviews: Json;
          subheadline: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          faqs?: Json;
          generated_by?: string | null;
          headline: string;
          id?: string;
          pain_points?: Json;
          product_id: string;
          reviews?: Json;
          subheadline: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          faqs?: Json;
          generated_by?: string | null;
          headline?: string;
          id?: string;
          pain_points?: Json;
          product_id?: string;
          reviews?: Json;
          subheadline?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_landing_copy_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_landing_copy_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reviews: {
        Row: {
          created_at: string;
          id: string;
          is_approved: boolean;
          product_id: string;
          rating: number;
          review_text: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_approved?: boolean;
          product_id: string;
          rating: number;
          review_text?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_approved?: boolean;
          product_id?: string;
          rating?: number;
          review_text?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          additional_price: number | null;
          cogs: number | null;
          created_at: string | null;
          external_variant_id: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean | null;
          name: string;
          option1_name: string | null;
          option1_value: string | null;
          option2_name: string | null;
          option2_value: string | null;
          product_id: string | null;
          retail_price: number | null;
          sku: string | null;
          stock_quantity: number | null;
          title: string | null;
          value: string;
        };
        Insert: {
          additional_price?: number | null;
          cogs?: number | null;
          created_at?: string | null;
          external_variant_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean | null;
          name: string;
          option1_name?: string | null;
          option1_value?: string | null;
          option2_name?: string | null;
          option2_value?: string | null;
          product_id?: string | null;
          retail_price?: number | null;
          sku?: string | null;
          stock_quantity?: number | null;
          title?: string | null;
          value: string;
        };
        Update: {
          additional_price?: number | null;
          cogs?: number | null;
          created_at?: string | null;
          external_variant_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean | null;
          name?: string;
          option1_name?: string | null;
          option1_value?: string | null;
          option2_name?: string | null;
          option2_value?: string | null;
          product_id?: string | null;
          retail_price?: number | null;
          sku?: string | null;
          stock_quantity?: number | null;
          title?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          cogs: number | null;
          compare_at_price: number | null;
          created_at: string;
          currency: string | null;
          description: string | null;
          dimensions: Json | null;
          external_id: string | null;
          gallery_urls: string[] | null;
          id: string;
          is_active: boolean;
          last_stock_sync: string | null;
          price: number;
          rating: number | null;
          review_count: number | null;
          shipping_cost: number | null;
          sku: string | null;
          slug: string;
          source: string | null;
          source_product_id: string | null;
          source_provider: string | null;
          source_url: string | null;
          status: string | null;
          stock_quantity: number;
          stock_status: string;
          supplier_url: string | null;
          tags: string[] | null;
          target_markets: string[];
          title: string;
          updated_at: string;
          weight_kg: number | null;
        };
        Insert: {
          category_id?: string | null;
          cogs?: number | null;
          compare_at_price?: number | null;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          dimensions?: Json | null;
          external_id?: string | null;
          gallery_urls?: string[] | null;
          id?: string;
          is_active?: boolean;
          last_stock_sync?: string | null;
          price?: number;
          rating?: number | null;
          review_count?: number | null;
          shipping_cost?: number | null;
          sku?: string | null;
          slug: string;
          source?: string | null;
          source_product_id?: string | null;
          source_provider?: string | null;
          source_url?: string | null;
          status?: string | null;
          stock_quantity?: number;
          stock_status?: string;
          supplier_url?: string | null;
          tags?: string[] | null;
          target_markets?: string[];
          title: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          category_id?: string | null;
          cogs?: number | null;
          compare_at_price?: number | null;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          dimensions?: Json | null;
          external_id?: string | null;
          gallery_urls?: string[] | null;
          id?: string;
          is_active?: boolean;
          last_stock_sync?: string | null;
          price?: number;
          rating?: number | null;
          review_count?: number | null;
          shipping_cost?: number | null;
          sku?: string | null;
          slug?: string;
          source?: string | null;
          source_product_id?: string | null;
          source_provider?: string | null;
          source_url?: string | null;
          status?: string | null;
          stock_quantity?: number;
          stock_status?: string;
          supplier_url?: string | null;
          tags?: string[] | null;
          target_markets?: string[];
          title?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          date_of_birth: string | null;
          email: string | null;
          full_name: string | null;
          gender: string | null;
          id: string;
          marketing_opt_in: boolean;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          full_name?: string | null;
          gender?: string | null;
          id: string;
          marketing_opt_in?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          full_name?: string | null;
          gender?: string | null;
          id?: string;
          marketing_opt_in?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      promotions: {
        Row: {
          created_at: string;
          discount_value: number;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          discount_value?: number;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          discount_value?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      researched_products: {
        Row: {
          ai_reasoning: string | null;
          ai_score: number;
          category: string | null;
          competition_analysis: Json | null;
          created_at: string;
          description: string | null;
          external_url: string | null;
          id: string;
          images: string[] | null;
          imported_product_id: string | null;
          profit_margin: number | null;
          source: string;
          status: string;
          suggested_price: number | null;
          supplier_price: number | null;
          title: string;
          trend_data: Json | null;
        };
        Insert: {
          ai_reasoning?: string | null;
          ai_score?: number;
          category?: string | null;
          competition_analysis?: Json | null;
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          images?: string[] | null;
          imported_product_id?: string | null;
          profit_margin?: number | null;
          source: string;
          status?: string;
          suggested_price?: number | null;
          supplier_price?: number | null;
          title: string;
          trend_data?: Json | null;
        };
        Update: {
          ai_reasoning?: string | null;
          ai_score?: number;
          category?: string | null;
          competition_analysis?: Json | null;
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          images?: string[] | null;
          imported_product_id?: string | null;
          profit_margin?: number | null;
          source?: string;
          status?: string;
          suggested_price?: number | null;
          supplier_price?: number | null;
          title?: string;
          trend_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "researched_products_imported_product_id_fkey";
            columns: ["imported_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "researched_products_imported_product_id_fkey";
            columns: ["imported_product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
      response_cache: {
        Row: {
          cache_key: string;
          expires_at: string;
          hit_count: number;
          payload: Json;
          rendered: string | null;
          state_hash: string;
          updated_at: string;
        };
        Insert: {
          cache_key: string;
          expires_at: string;
          hit_count?: number;
          payload: Json;
          rendered?: string | null;
          state_hash: string;
          updated_at?: string;
        };
        Update: {
          cache_key?: string;
          expires_at?: string;
          hit_count?: number;
          payload?: Json;
          rendered?: string | null;
          state_hash?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      return_requests: {
        Row: {
          admin_notes: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          order_id: string | null;
          photo_urls: string[] | null;
          processed_at: string | null;
          reason: string | null;
          reason_category: string | null;
          refunded_at: string | null;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          admin_notes?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_id?: string | null;
          photo_urls?: string[] | null;
          processed_at?: string | null;
          reason?: string | null;
          reason_category?: string | null;
          refunded_at?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          admin_notes?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_id?: string | null;
          photo_urls?: string[] | null;
          processed_at?: string | null;
          reason?: string | null;
          reason_category?: string | null;
          refunded_at?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      security_events: {
        Row: {
          created_at: string;
          details: Json;
          endpoint: string | null;
          id: string;
          ip_address: string | null;
          kind: Database["public"]["Enums"]["security_event_kind"];
          patch_proposal_id: string | null;
          resolved: boolean;
          severity: Database["public"]["Enums"]["security_threat_level"];
          source: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          endpoint?: string | null;
          id?: string;
          ip_address?: string | null;
          kind: Database["public"]["Enums"]["security_event_kind"];
          patch_proposal_id?: string | null;
          resolved?: boolean;
          severity?: Database["public"]["Enums"]["security_threat_level"];
          source: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: Json;
          endpoint?: string | null;
          id?: string;
          ip_address?: string | null;
          kind?: Database["public"]["Enums"]["security_event_kind"];
          patch_proposal_id?: string | null;
          resolved?: boolean;
          severity?: Database["public"]["Enums"]["security_threat_level"];
          source?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      security_scan_runs: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          events_detected: number;
          id: string;
          patches_queued: number;
          summary: Json;
          trigger: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          events_detected?: number;
          id?: string;
          patches_queued?: number;
          summary?: Json;
          trigger: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          events_detected?: number;
          id?: string;
          patches_queued?: number;
          summary?: Json;
          trigger?: string;
        };
        Relationships: [];
      };
      sensitive_field_access_logs: {
        Row: {
          context: string | null;
          created_at: string;
          fields: string[];
          id: string;
          ip_address: string | null;
          record_ids: string[];
          row_count: number;
          table_name: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          context?: string | null;
          created_at?: string;
          fields?: string[];
          id?: string;
          ip_address?: string | null;
          record_ids?: string[];
          row_count?: number;
          table_name: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          context?: string | null;
          created_at?: string;
          fields?: string[];
          id?: string;
          ip_address?: string | null;
          record_ids?: string[];
          row_count?: number;
          table_name?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      seo_scan_config: {
        Row: {
          auto_rescan_enabled: boolean;
          base_url: string;
          id: string;
          pagespeed_enabled: boolean;
          schedule_cron: string;
          singleton: boolean;
          target_urls: Json;
          updated_at: string;
        };
        Insert: {
          auto_rescan_enabled?: boolean;
          base_url?: string;
          id?: string;
          pagespeed_enabled?: boolean;
          schedule_cron?: string;
          singleton?: boolean;
          target_urls?: Json;
          updated_at?: string;
        };
        Update: {
          auto_rescan_enabled?: boolean;
          base_url?: string;
          id?: string;
          pagespeed_enabled?: boolean;
          schedule_cron?: string;
          singleton?: boolean;
          target_urls?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      seo_scan_findings: {
        Row: {
          category: string;
          check_id: string;
          created_at: string;
          fix_hint: string | null;
          id: string;
          message: string;
          raw: Json | null;
          run_id: string;
          severity: string;
          url: string;
        };
        Insert: {
          category: string;
          check_id: string;
          created_at?: string;
          fix_hint?: string | null;
          id?: string;
          message: string;
          raw?: Json | null;
          run_id: string;
          severity: string;
          url: string;
        };
        Update: {
          category?: string;
          check_id?: string;
          created_at?: string;
          fix_hint?: string | null;
          id?: string;
          message?: string;
          raw?: Json | null;
          run_id?: string;
          severity?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seo_scan_findings_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "seo_scan_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      seo_scan_runs: {
        Row: {
          deploy_id: string | null;
          fail_count: number;
          finished_at: string | null;
          id: string;
          notes: string | null;
          pass_count: number;
          score: number | null;
          started_at: string;
          trigger: string;
          warn_count: number;
        };
        Insert: {
          deploy_id?: string | null;
          fail_count?: number;
          finished_at?: string | null;
          id?: string;
          notes?: string | null;
          pass_count?: number;
          score?: number | null;
          started_at?: string;
          trigger?: string;
          warn_count?: number;
        };
        Update: {
          deploy_id?: string | null;
          fail_count?: number;
          finished_at?: string | null;
          id?: string;
          notes?: string | null;
          pass_count?: number;
          score?: number | null;
          started_at?: string;
          trigger?: string;
          warn_count?: number;
        };
        Relationships: [];
      };
      shipping_rates: {
        Row: {
          base_cost: number;
          created_at: string;
          id: string;
          is_active: boolean;
          max_days: number;
          min_days: number;
          per_kg_cost: number;
          shipping_type: string;
          zone_name: string;
        };
        Insert: {
          base_cost?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          max_days?: number;
          min_days?: number;
          per_kg_cost?: number;
          shipping_type: string;
          zone_name: string;
        };
        Update: {
          base_cost?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          max_days?: number;
          min_days?: number;
          per_kg_cost?: number;
          shipping_type?: string;
          zone_name?: string;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          content_data: Json | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          section_name: string | null;
        };
        Insert: {
          content_data?: Json | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          section_name?: string | null;
        };
        Update: {
          content_data?: Json | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          section_name?: string | null;
        };
        Relationships: [];
      };
      stock_sync_logs: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          new_stock: number | null;
          old_stock: number | null;
          product_id: string | null;
          provider: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          new_stock?: number | null;
          old_stock?: number | null;
          product_id?: string | null;
          provider?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          new_stock?: number | null;
          old_stock?: number | null;
          product_id?: string | null;
          provider?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      storage_logs: {
        Row: {
          attempts: number;
          bucket: string | null;
          created_at: string;
          destination_url: string | null;
          error_message: string | null;
          event_type: string;
          id: string;
          metadata: Json;
          r2_key: string | null;
          size_bytes: number | null;
          source_path: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          bucket?: string | null;
          created_at?: string;
          destination_url?: string | null;
          error_message?: string | null;
          event_type: string;
          id?: string;
          metadata?: Json;
          r2_key?: string | null;
          size_bytes?: number | null;
          source_path?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          bucket?: string | null;
          created_at?: string;
          destination_url?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          metadata?: Json;
          r2_key?: string | null;
          size_bytes?: number | null;
          source_path?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sub_agents: {
        Row: {
          capabilities: string[];
          created_at: string;
          display_name: string;
          failure_count: number;
          id: string;
          is_active: boolean;
          last_error: string | null;
          last_invoked_at: string | null;
          payload_kind: string;
          role_title: string;
          slug: string;
          success_count: number;
          system_prompt: string;
          updated_at: string;
        };
        Insert: {
          capabilities?: string[];
          created_at?: string;
          display_name: string;
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_error?: string | null;
          last_invoked_at?: string | null;
          payload_kind?: string;
          role_title: string;
          slug: string;
          success_count?: number;
          system_prompt: string;
          updated_at?: string;
        };
        Update: {
          capabilities?: string[];
          created_at?: string;
          display_name?: string;
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_error?: string | null;
          last_invoked_at?: string | null;
          payload_kind?: string;
          role_title?: string;
          slug?: string;
          success_count?: number;
          system_prompt?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          api_endpoint: string | null;
          api_key_ref: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          last_sync_at: string | null;
          name: string;
          provider: string;
        };
        Insert: {
          api_endpoint?: string | null;
          api_key_ref?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_sync_at?: string | null;
          name: string;
          provider?: string;
        };
        Update: {
          api_endpoint?: string | null;
          api_key_ref?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_sync_at?: string | null;
          name?: string;
          provider?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          created_at: string | null;
          id: string;
          status: string | null;
          subject: string;
          ticket_number: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          status?: string | null;
          subject: string;
          ticket_number?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          status?: string | null;
          subject?: string;
          ticket_number?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      telegram_chat_history: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      telegram_file_ingest: {
        Row: {
          chat_id: string;
          created_at: string;
          error: string | null;
          file_id: string;
          file_name: string | null;
          id: string;
          mime_type: string | null;
          proposal_id: string | null;
          size_bytes: number | null;
          status: string;
          storage_path: string | null;
          target_agent: string | null;
          task: string | null;
          text_preview: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          error?: string | null;
          file_id: string;
          file_name?: string | null;
          id?: string;
          mime_type?: string | null;
          proposal_id?: string | null;
          size_bytes?: number | null;
          status?: string;
          storage_path?: string | null;
          target_agent?: string | null;
          task?: string | null;
          text_preview?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          error?: string | null;
          file_id?: string;
          file_name?: string | null;
          id?: string;
          mime_type?: string | null;
          proposal_id?: string | null;
          size_bytes?: number | null;
          status?: string;
          storage_path?: string | null;
          target_agent?: string | null;
          task?: string | null;
          text_preview?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tracking_pixels: {
        Row: {
          id: string;
          is_active: boolean | null;
          pixel_id: string | null;
          pixel_name: string | null;
        };
        Insert: {
          id?: string;
          is_active?: boolean | null;
          pixel_id?: string | null;
          pixel_name?: string | null;
        };
        Update: {
          id?: string;
          is_active?: boolean | null;
          pixel_id?: string | null;
          pixel_name?: string | null;
        };
        Relationships: [];
      };
      translations: {
        Row: {
          content_key: string;
          created_at: string;
          id: string;
          language_code: string;
          translated_text: string;
        };
        Insert: {
          content_key: string;
          created_at?: string;
          id?: string;
          language_code: string;
          translated_text: string;
        };
        Update: {
          content_key?: string;
          created_at?: string;
          id?: string;
          language_code?: string;
          translated_text?: string;
        };
        Relationships: [];
      };
      user_addresses: {
        Row: {
          city: string | null;
          country_code: string | null;
          country_name: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          is_default: boolean;
          label: string | null;
          line1: string;
          line2: string | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          country_code?: string | null;
          country_name?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          line1: string;
          line2?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string | null;
          country_code?: string | null;
          country_name?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          line1?: string;
          line2?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      viral_alerts: {
        Row: {
          auto_suggested: boolean;
          id: string;
          intel_id: string;
          message: string | null;
          notified_at: string;
          pending_approval_id: string | null;
          product_ref: string;
        };
        Insert: {
          auto_suggested?: boolean;
          id?: string;
          intel_id: string;
          message?: string | null;
          notified_at?: string;
          pending_approval_id?: string | null;
          product_ref: string;
        };
        Update: {
          auto_suggested?: boolean;
          id?: string;
          intel_id?: string;
          message?: string | null;
          notified_at?: string;
          pending_approval_id?: string | null;
          product_ref?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viral_alerts_intel_id_fkey";
            columns: ["intel_id"];
            isOneToOne: false;
            referencedRelation: "competitor_ad_intel";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viral_alerts_pending_approval_id_fkey";
            columns: ["pending_approval_id"];
            isOneToOne: false;
            referencedRelation: "pending_product_approvals";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_agent_settings: {
        Row: {
          delay_seconds: number;
          enabled: boolean;
          id: string;
          script_template: string;
          updated_at: string;
        };
        Insert: {
          delay_seconds?: number;
          enabled?: boolean;
          id?: string;
          script_template?: string;
          updated_at?: string;
        };
        Update: {
          delay_seconds?: number;
          enabled?: boolean;
          id?: string;
          script_template?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      voice_call_logs: {
        Row: {
          created_at: string;
          customer_name: string | null;
          dtmf_digit: string | null;
          id: string;
          order_id: string;
          phone: string | null;
          provider: string;
          script: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_name?: string | null;
          dtmf_digit?: string | null;
          id?: string;
          order_id: string;
          phone?: string | null;
          provider?: string;
          script: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_name?: string | null;
          dtmf_digit?: string | null;
          id?: string;
          order_id?: string;
          phone?: string | null;
          provider?: string;
          script?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      voice_call_queue: {
        Row: {
          attempts: number;
          created_at: string;
          id: string;
          last_error: string | null;
          order_id: string;
          scheduled_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          order_id: string;
          scheduled_at: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          order_id?: string;
          scheduled_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhook_delivery_logs: {
        Row: {
          delivered_at: string | null;
          event_type: string;
          id: string;
          payload: Json | null;
          response_body: string | null;
          response_status: number | null;
          retry_count: number | null;
          webhook_id: string | null;
        };
        Insert: {
          delivered_at?: string | null;
          event_type: string;
          id?: string;
          payload?: Json | null;
          response_body?: string | null;
          response_status?: number | null;
          retry_count?: number | null;
          webhook_id?: string | null;
        };
        Update: {
          delivered_at?: string | null;
          event_type?: string;
          id?: string;
          payload?: Json | null;
          response_body?: string | null;
          response_status?: number | null;
          retry_count?: number | null;
          webhook_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_logs_webhook_id_fkey";
            columns: ["webhook_id"];
            isOneToOne: false;
            referencedRelation: "webhooks";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_secrets: {
        Row: {
          secret: string;
          webhook_id: string;
        };
        Insert: {
          secret: string;
          webhook_id: string;
        };
        Update: {
          secret?: string;
          webhook_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_secrets_webhook_id_fkey";
            columns: ["webhook_id"];
            isOneToOne: true;
            referencedRelation: "webhooks";
            referencedColumns: ["id"];
          },
        ];
      };
      webhooks: {
        Row: {
          created_at: string | null;
          event_types: string[];
          id: string;
          is_active: boolean | null;
          target_url: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          event_types: string[];
          id?: string;
          is_active?: boolean | null;
          target_url: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          event_types?: string[];
          id?: string;
          is_active?: boolean | null;
          target_url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wishlists: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlists_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_public";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      payment_methods_public: {
        Row: {
          display_name: string | null;
          display_name_bn: string | null;
          icon_name: string | null;
          id: string | null;
          instructions: string | null;
          instructions_bn: string | null;
          is_active: boolean | null;
          method_key: string | null;
          sort_order: number | null;
        };
        Insert: {
          display_name?: string | null;
          display_name_bn?: string | null;
          icon_name?: string | null;
          id?: string | null;
          instructions?: string | null;
          instructions_bn?: string | null;
          is_active?: boolean | null;
          method_key?: string | null;
          sort_order?: number | null;
        };
        Update: {
          display_name?: string | null;
          display_name_bn?: string | null;
          icon_name?: string | null;
          id?: string | null;
          instructions?: string | null;
          instructions_bn?: string | null;
          is_active?: boolean | null;
          method_key?: string | null;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      products_public: {
        Row: {
          created_at: string | null;
          description: string | null;
          dimensions: Json | null;
          gallery_urls: string[] | null;
          id: string | null;
          is_active: boolean | null;
          price: number | null;
          sku: string | null;
          slug: string | null;
          title: string | null;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          dimensions?: Json | null;
          gallery_urls?: string[] | null;
          id?: string | null;
          is_active?: boolean | null;
          price?: number | null;
          sku?: string | null;
          slug?: string | null;
          title?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          dimensions?: Json | null;
          gallery_urls?: string[] | null;
          id?: string | null;
          is_active?: boolean | null;
          price?: number | null;
          sku?: string | null;
          slug?: string | null;
          title?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_delete_cron_job: { Args: { p_jobname: string }; Returns: boolean };
      admin_set_cron_job_active: {
        Args: { p_active: boolean; p_jobname: string };
        Returns: undefined;
      };
      admin_trigger_cron_job: { Args: { p_jobname: string }; Returns: string };
      admin_upsert_cron_job: {
        Args: { p_command: string; p_jobname: string; p_schedule: string };
        Returns: number;
      };
      create_order: {
        Args: {
          p_coupon_code?: string;
          p_email?: string;
          p_items: Json;
          p_payment_method?: string;
          p_shipping: Json;
        };
        Returns: Json;
      };
      delete_integration_secret: {
        Args: { p_provider: string };
        Returns: undefined;
      };
      get_active_dynamic_ui_settings: {
        Args: never;
        Returns: {
          component_name: string;
          css_classes: string;
          is_active: boolean;
          json_data: Json;
          updated_at: string;
        }[];
      };
      get_active_marketing_trackers: {
        Args: never;
        Returns: {
          is_active: boolean;
          provider: string;
          script_code: string;
          tracker_id: string;
        }[];
      };
      get_agent_memory_context:
        | {
            Args: { p_directive_limit?: number; p_research_limit?: number };
            Returns: Json;
          }
        | {
            Args: {
              p_directive_limit?: number;
              p_learning_limit?: number;
              p_research_limit?: number;
              p_scope?: string;
            };
            Returns: Json;
          };
      get_cj_api_key: { Args: never; Returns: string };
      get_cron_jobs_status: { Args: never; Returns: Json };
      get_dynamic_ui_settings_admin: {
        Args: never;
        Returns: {
          component_name: string;
          created_at: string;
          css_classes: string | null;
          custom_js: string | null;
          id: string;
          is_active: boolean;
          json_data: Json | null;
          prompt: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "dynamic_ui_settings";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_guest_order: {
        Args: { p_token: string };
        Returns: {
          items: Json;
          order_data: Json;
        }[];
      };
      get_user_roles: {
        Args: { p_user: string };
        Returns: Database["public"]["Enums"]["app_role"][];
      };
      has_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"];
          p_user: string;
        };
        Returns: boolean;
      };
      log_security_event: {
        Args: {
          p_details?: Json;
          p_endpoint?: string;
          p_ip?: string;
          p_kind: Database["public"]["Enums"]["security_event_kind"];
          p_severity: Database["public"]["Enums"]["security_threat_level"];
          p_source: string;
          p_user_agent?: string;
          p_user_id?: string;
        };
        Returns: string;
      };
      run_stock_sync_cron: { Args: never; Returns: number };
      set_cj_api_key: { Args: { p_key: string }; Returns: undefined };
      set_integration_secret: {
        Args: {
          p_activate?: boolean;
          p_api_key: string;
          p_extra_config?: Json;
          p_provider: string;
        };
        Returns: undefined;
      };
      upsert_agent_learning: {
        Args: {
          p_category: string;
          p_importance?: number;
          p_key: string;
          p_lock?: boolean;
          p_scope: string;
          p_source_agent?: string;
          p_source_ref?: string;
          p_tags?: string[];
          p_value: string;
        };
        Returns: string;
      };
      verify_api_key: { Args: { raw_key: string }; Returns: string };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded";
      pending_approval_status: "pending" | "approved" | "rejected" | "failed";
      security_event_kind:
        | "session_integrity"
        | "parameter_tampering"
        | "file_magic_byte_mismatch"
        | "api_token_misuse"
        | "rate_anomaly"
        | "rls_bypass_attempt"
        | "webhook_signature_failure"
        | "auth_brute_force";
      security_patch_status: "pending" | "approved" | "rejected" | "applied";
      security_threat_level: "low" | "medium" | "high" | "critical";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      pending_approval_status: ["pending", "approved", "rejected", "failed"],
      security_event_kind: [
        "session_integrity",
        "parameter_tampering",
        "file_magic_byte_mismatch",
        "api_token_misuse",
        "rate_anomaly",
        "rls_bypass_attempt",
        "webhook_signature_failure",
        "auth_brute_force",
      ],
      security_patch_status: ["pending", "approved", "rejected", "applied"],
      security_threat_level: ["low", "medium", "high", "critical"],
    },
  },
} as const;
