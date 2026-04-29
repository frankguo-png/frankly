export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          id: string
          user_id: string
          org_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          id: string
          org_id: string
          plaid_item_id: string | null
          plaid_access_token: string | null
          plaid_account_id: string | null
          bank_name: string
          account_name: string | null
          account_type: string | null
          currency: string
          current_balance: number | null
          available_balance: number | null
          last_synced_at: string | null
          plaid_cursor: string | null
          connection_status: 'active' | 'error' | 'disconnected'
          entity_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          plaid_item_id?: string | null
          plaid_access_token?: string | null
          plaid_account_id?: string | null
          bank_name: string
          entity_id?: string | null
          account_name?: string | null
          account_type?: string | null
          currency?: string
          current_balance?: number | null
          available_balance?: number | null
          last_synced_at?: string | null
          plaid_cursor?: string | null
          connection_status?: 'active' | 'error' | 'disconnected'
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          plaid_item_id?: string | null
          plaid_access_token?: string | null
          plaid_account_id?: string | null
          bank_name?: string
          account_name?: string | null
          account_type?: string | null
          currency?: string
          current_balance?: number | null
          available_balance?: number | null
          last_synced_at?: string | null
          plaid_cursor?: string | null
          connection_status?: 'active' | 'error' | 'disconnected'
          created_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          id: string
          org_id: string
          name: string
          short_code: string | null
          currency: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          short_code?: string | null
          currency?: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          short_code?: string | null
          currency?: string
          color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          org_id: string
          bank_account_id: string | null
          entity_id: string | null
          date: string
          amount: number
          currency: string
          description: string | null
          vendor: string | null
          category: string | null
          department: string | null
          project: string | null
          source: 'plaid' | 'qbo' | 'rippling' | 'manual'
          source_transaction_id: string | null
          is_duplicate: boolean
          merged_with: string | null
          is_transfer: boolean
          categorization_status: 'uncategorized' | 'rule_matched' | 'ai_suggested' | 'manual'
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          bank_account_id?: string | null
          entity_id?: string | null
          date: string
          amount: number
          currency?: string
          description?: string | null
          vendor?: string | null
          category?: string | null
          department?: string | null
          project?: string | null
          source: 'plaid' | 'qbo' | 'rippling' | 'manual'
          source_transaction_id?: string | null
          is_duplicate?: boolean
          merged_with?: string | null
          is_transfer?: boolean
          categorization_status?: 'uncategorized' | 'rule_matched' | 'ai_suggested' | 'manual'
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          bank_account_id?: string | null
          entity_id?: string | null
          date?: string
          amount?: number
          currency?: string
          description?: string | null
          vendor?: string | null
          category?: string | null
          department?: string | null
          project?: string | null
          source?: 'plaid' | 'qbo' | 'rippling' | 'manual'
          source_transaction_id?: string | null
          is_duplicate?: boolean
          merged_with?: string | null
          is_transfer?: boolean
          categorization_status?: 'uncategorized' | 'rule_matched' | 'ai_suggested' | 'manual'
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_allocations: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          employee_name: string
          employment_type: 'full_time' | 'part_time' | 'contractor' | 'hourly' | 'intern' | null
          annual_salary: number | null
          hourly_rate: number | null
          hours_per_week: number | null
          department: string | null
          project_allocations: Json
          effective_date: string
          end_date: string | null
          created_at: string
          entity_id: string | null
          currency: string
        }
        Insert: {
          id?: string
          org_id: string
          employee_id: string
          employee_name: string
          employment_type?: 'full_time' | 'part_time' | 'contractor' | 'hourly' | 'intern' | null
          annual_salary?: number | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          department?: string | null
          project_allocations?: Json
          effective_date: string
          end_date?: string | null
          created_at?: string
          entity_id?: string | null
          currency?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string
          employee_name?: string
          employment_type?: 'full_time' | 'part_time' | 'contractor' | 'hourly' | 'intern' | null
          annual_salary?: number | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          department?: string | null
          project_allocations?: Json
          effective_date?: string
          end_date?: string | null
          created_at?: string
          entity_id?: string | null
          currency?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          id: string
          org_id: string
          source: string
          sync_type: string
          started_at: string
          completed_at: string | null
          records_fetched: number
          records_created: number
          records_updated: number
          status: 'running' | 'completed' | 'failed'
          error_message: string | null
        }
        Insert: {
          id?: string
          org_id: string
          source: string
          sync_type: string
          started_at?: string
          completed_at?: string | null
          records_fetched?: number
          records_created?: number
          records_updated?: number
          status?: 'running' | 'completed' | 'failed'
          error_message?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          source?: string
          sync_type?: string
          started_at?: string
          completed_at?: string | null
          records_fetched?: number
          records_created?: number
          records_updated?: number
          status?: 'running' | 'completed' | 'failed'
          error_message?: string | null
        }
        Relationships: []
      }
      qbo_connections: {
        Row: {
          id: string
          org_id: string
          realm_id: string
          company_name: string | null
          access_token: string
          refresh_token: string
          token_expires_at: string
          last_synced_at: string | null
          connection_status: 'active' | 'error' | 'disconnected'
          entity_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          realm_id: string
          company_name?: string | null
          access_token: string
          refresh_token: string
          token_expires_at: string
          last_synced_at?: string | null
          connection_status?: 'active' | 'error' | 'disconnected'
          entity_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          realm_id?: string
          company_name?: string | null
          access_token?: string
          refresh_token?: string
          token_expires_at?: string
          last_synced_at?: string | null
          connection_status?: 'active' | 'error' | 'disconnected'
          entity_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          id: string
          org_id: string
          category: string | null
          department: string | null
          project: string | null
          monthly_amount: number
          effective_month: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          category?: string | null
          department?: string | null
          project?: string | null
          monthly_amount: number
          effective_month: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          category?: string | null
          department?: string | null
          project?: string | null
          monthly_amount?: number
          effective_month?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          org_id: string
          name: string
          title: string | null
          department: string | null
          manager_id: string | null
          email: string | null
          avatar_url: string | null
          status: 'active' | 'inactive'
          start_date: string | null
          salary: number | null
          created_at: string
          rippling_id: string | null
          rippling_manager_id: string | null
          country: string | null
          location_type: string | null
          is_manager: boolean
          salary_effective_date: string | null
          entity_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          title?: string | null
          department?: string | null
          manager_id?: string | null
          email?: string | null
          avatar_url?: string | null
          status?: 'active' | 'inactive'
          start_date?: string | null
          salary?: number | null
          created_at?: string
          rippling_id?: string | null
          rippling_manager_id?: string | null
          country?: string | null
          location_type?: string | null
          is_manager?: boolean
          salary_effective_date?: string | null
          entity_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          title?: string | null
          department?: string | null
          manager_id?: string | null
          email?: string | null
          avatar_url?: string | null
          status?: 'active' | 'inactive'
          start_date?: string | null
          salary?: number | null
          created_at?: string
          rippling_id?: string | null
          rippling_manager_id?: string | null
          country?: string | null
          location_type?: string | null
          is_manager?: boolean
          salary_effective_date?: string | null
          entity_id?: string | null
        }
        Relationships: []
      }
      category_rules: {
        Row: {
          id: string
          org_id: string
          rule_name: string | null
          rule_type: 'exact' | 'contains' | 'regex'
          match_field: 'vendor' | 'description' | 'amount'
          match_value: string
          target_category: string | null
          target_department: string | null
          target_project: string | null
          priority: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rule_name?: string | null
          rule_type: 'exact' | 'contains' | 'regex'
          match_field: 'vendor' | 'description' | 'amount'
          match_value: string
          target_category?: string | null
          target_department?: string | null
          target_project?: string | null
          priority?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          rule_name?: string | null
          rule_type?: 'exact' | 'contains' | 'regex'
          match_field?: 'vendor' | 'description' | 'amount'
          match_value?: string
          target_category?: string | null
          target_department?: string | null
          target_project?: string | null
          priority?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          id: string
          org_id: string
          name: string
          company: string | null
          amount: number
          probability: number
          stage: 'pitched' | 'negotiating' | 'verbal' | 'closed_won' | 'closed_lost'
          expected_close_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          company?: string | null
          amount: number
          probability?: number
          stage?: 'pitched' | 'negotiating' | 'verbal' | 'closed_won' | 'closed_lost'
          expected_close_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          company?: string | null
          amount?: number
          probability?: number
          stage?: 'pitched' | 'negotiating' | 'verbal' | 'closed_won' | 'closed_lost'
          expected_close_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          id: string
          org_id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_payments: {
        Row: {
          id: string
          org_id: string
          vendor: string
          description: string | null
          amount: number
          due_date: string
          priority: 'critical' | 'high' | 'normal' | 'low'
          status: 'pending' | 'overdue' | 'paid' | 'scheduled'
          category: string | null
          invoice_number: string | null
          payment_terms: 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'net_90' | null
          invoice_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          vendor: string
          description?: string | null
          amount: number
          due_date: string
          priority?: 'critical' | 'high' | 'normal' | 'low'
          status?: 'pending' | 'overdue' | 'paid' | 'scheduled'
          category?: string | null
          invoice_number?: string | null
          payment_terms?: 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'net_90' | null
          invoice_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          vendor?: string
          description?: string | null
          amount?: number
          due_date?: string
          priority?: 'critical' | 'high' | 'normal' | 'low'
          status?: 'pending' | 'overdue' | 'paid' | 'scheduled'
          category?: string | null
          invoice_number?: string | null
          payment_terms?: 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'net_90' | null
          invoice_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      review_cycles: {
        Row: {
          id: string
          org_id: string
          name: string
          period_start: string
          period_end: string
          self_review_deadline: string | null
          manager_review_deadline: string | null
          calibration_deadline: string | null
          status: 'draft' | 'active' | 'calibration' | 'finalized' | 'closed'
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          period_start: string
          period_end: string
          self_review_deadline?: string | null
          manager_review_deadline?: string | null
          calibration_deadline?: string | null
          status?: 'draft' | 'active' | 'calibration' | 'finalized' | 'closed'
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          period_start?: string
          period_end?: string
          self_review_deadline?: string | null
          manager_review_deadline?: string | null
          calibration_deadline?: string | null
          status?: 'draft' | 'active' | 'calibration' | 'finalized' | 'closed'
          created_at?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          id: string
          org_id: string
          cycle_id: string
          employee_id: string
          reviewer_id: string | null
          status: 'not_started' | 'self_review' | 'manager_review' | 'calibration' | 'finalized' | 'acknowledged'
          overall_rating: number | null
          self_rating: number | null
          strengths: string | null
          areas_for_improvement: string | null
          development_plan: string | null
          manager_comments: string | null
          employee_comments: string | null
          finalized_at: string | null
          acknowledged_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          cycle_id: string
          employee_id: string
          reviewer_id?: string | null
          status?: 'not_started' | 'self_review' | 'manager_review' | 'calibration' | 'finalized' | 'acknowledged'
          overall_rating?: number | null
          self_rating?: number | null
          strengths?: string | null
          areas_for_improvement?: string | null
          development_plan?: string | null
          manager_comments?: string | null
          employee_comments?: string | null
          finalized_at?: string | null
          acknowledged_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          cycle_id?: string
          employee_id?: string
          reviewer_id?: string | null
          status?: 'not_started' | 'self_review' | 'manager_review' | 'calibration' | 'finalized' | 'acknowledged'
          overall_rating?: number | null
          self_rating?: number | null
          strengths?: string | null
          areas_for_improvement?: string | null
          development_plan?: string | null
          manager_comments?: string | null
          employee_comments?: string | null
          finalized_at?: string | null
          acknowledged_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_goals: {
        Row: {
          id: string
          review_id: string
          description: string
          weight: number
          self_rating: number | null
          manager_rating: number | null
          self_comments: string | null
          manager_comments: string | null
          goal_status: 'not_started' | 'in_progress' | 'completed' | 'exceeded'
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          description: string
          weight?: number
          self_rating?: number | null
          manager_rating?: number | null
          self_comments?: string | null
          manager_comments?: string | null
          goal_status?: 'not_started' | 'in_progress' | 'completed' | 'exceeded'
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          description?: string
          weight?: number
          self_rating?: number | null
          manager_rating?: number | null
          self_comments?: string | null
          manager_comments?: string | null
          goal_status?: 'not_started' | 'in_progress' | 'completed' | 'exceeded'
          created_at?: string
        }
        Relationships: []
      }
      bonuses: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          proposed_by: string | null
          bonus_type: 'annual_performance' | 'spot' | 'retention' | 'signing' | 'project_completion' | 'referral'
          amount: number
          percentage_of_salary: number | null
          base_salary_at_time: number | null
          related_review_id: string | null
          performance_rating_at_time: number | null
          reason: string | null
          status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'paid'
          fiscal_year: number | null
          fiscal_quarter: number | null
          effective_date: string | null
          payout_date: string | null
          approved_at: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          employee_id: string
          proposed_by?: string | null
          bonus_type: 'annual_performance' | 'spot' | 'retention' | 'signing' | 'project_completion' | 'referral'
          amount: number
          percentage_of_salary?: number | null
          base_salary_at_time?: number | null
          related_review_id?: string | null
          performance_rating_at_time?: number | null
          reason?: string | null
          status?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'paid'
          fiscal_year?: number | null
          fiscal_quarter?: number | null
          effective_date?: string | null
          payout_date?: string | null
          approved_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string
          proposed_by?: string | null
          bonus_type?: 'annual_performance' | 'spot' | 'retention' | 'signing' | 'project_completion' | 'referral'
          amount?: number
          percentage_of_salary?: number | null
          base_salary_at_time?: number | null
          related_review_id?: string | null
          performance_rating_at_time?: number | null
          reason?: string | null
          status?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'paid'
          fiscal_year?: number | null
          fiscal_quarter?: number | null
          effective_date?: string | null
          payout_date?: string | null
          approved_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bonus_approvals: {
        Row: {
          id: string
          bonus_id: string
          approver_id: string
          approver_role: string | null
          status: 'pending' | 'approved' | 'rejected'
          comments: string | null
          decided_at: string | null
          approval_order: number
          created_at: string
        }
        Insert: {
          id?: string
          bonus_id: string
          approver_id: string
          approver_role?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          comments?: string | null
          decided_at?: string | null
          approval_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          bonus_id?: string
          approver_id?: string
          approver_role?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          comments?: string | null
          decided_at?: string | null
          approval_order?: number
          created_at?: string
        }
        Relationships: []
      }
      reconciliation_matches: {
        Row: {
          id: string
          org_id: string
          bank_tx_id: string | null
          accounting_tx_id: string | null
          match_type: 'auto' | 'manual'
          match_confidence: number | null
          status: 'matched' | 'dismissed' | 'unmatched'
          matched_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          bank_tx_id?: string | null
          accounting_tx_id?: string | null
          match_type: 'auto' | 'manual'
          match_confidence?: number | null
          status?: 'matched' | 'dismissed' | 'unmatched'
          matched_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          bank_tx_id?: string | null
          accounting_tx_id?: string | null
          match_type?: 'auto' | 'manual'
          match_confidence?: number | null
          status?: 'matched' | 'dismissed' | 'unmatched'
          matched_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
