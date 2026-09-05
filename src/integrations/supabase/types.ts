export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      acquisition_rehab_adders: {
        Row: {
          active: boolean
          adder_type: string
          created_at: string
          id: string
          included_in_heavy_full: boolean
          notes: string | null
          policy_id: string
          source_reference: string
          unit: string
          unit_cost_base: number
          unit_cost_high: number
          unit_cost_low: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          adder_type: string
          created_at?: string
          id?: string
          included_in_heavy_full?: boolean
          notes?: string | null
          policy_id: string
          source_reference: string
          unit: string
          unit_cost_base: number
          unit_cost_high: number
          unit_cost_low: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          adder_type?: string
          created_at?: string
          id?: string
          included_in_heavy_full?: boolean
          notes?: string | null
          policy_id?: string
          source_reference?: string
          unit?: string
          unit_cost_base?: number
          unit_cost_high?: number
          unit_cost_low?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_rehab_adders_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "acquisition_rehab_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      acquisition_rehab_class_rates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          minimum_rehab: number
          notes: string | null
          per_sqft_base: number
          per_sqft_high: number
          per_sqft_low: number
          policy_id: string
          rehab_class: string
          source_reference: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          minimum_rehab: number
          notes?: string | null
          per_sqft_base: number
          per_sqft_high: number
          per_sqft_low: number
          policy_id: string
          rehab_class: string
          source_reference: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          minimum_rehab?: number
          notes?: string | null
          per_sqft_base?: number
          per_sqft_high?: number
          per_sqft_low?: number
          policy_id?: string
          rehab_class?: string
          source_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_rehab_class_rates_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "acquisition_rehab_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      acquisition_rehab_policies: {
        Row: {
          created_at: string
          default_contingency_pct: number
          id: string
          market: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_contingency_pct: number
          id?: string
          market: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_contingency_pct?: number
          id?: string
          market?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_rehab_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          department_id: string | null
          entity_id: string | null
          entity_title: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          department_id?: string | null
          entity_id?: string | null
          entity_title?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          department_id?: string | null
          entity_id?: string | null
          entity_title?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      addon_packs: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          price_tier: string | null
          slug: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_tier?: string | null
          slug: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_tier?: string | null
          slug?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_api_credentials: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          rotated_from_id: string | null
          token_hash: string
          token_prefix: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          rotated_from_id?: string | null
          token_hash: string
          token_prefix: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          rotated_from_id?: string | null
          token_hash?: string
          token_prefix?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_credentials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_api_credentials_rotated_from_id_fkey"
            columns: ["rotated_from_id"]
            isOneToOne: false
            referencedRelation: "agent_api_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_api_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_audit_log: {
        Row: {
          action: string
          agent_id: string
          approval_request_id: string | null
          created_at: string
          credential_id: string | null
          duration_ms: number
          error_code: string | null
          error_summary: string | null
          http_status: number
          id: number
          input_summary: Json
          operation_id: string | null
          request_id: string
          resource_id: string | null
          resource_type: string | null
          source_ip: unknown
          status: string
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          agent_id: string
          approval_request_id?: string | null
          created_at?: string
          credential_id?: string | null
          duration_ms: number
          error_code?: string | null
          error_summary?: string | null
          http_status: number
          id?: never
          input_summary?: Json
          operation_id?: string | null
          request_id: string
          resource_id?: string | null
          resource_type?: string | null
          source_ip?: unknown
          status: string
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          agent_id?: string
          approval_request_id?: string | null
          created_at?: string
          credential_id?: string | null
          duration_ms?: number
          error_code?: string | null
          error_summary?: string | null
          http_status?: number
          id?: never
          input_summary?: Json
          operation_id?: string | null
          request_id?: string
          resource_id?: string | null
          resource_type?: string | null
          source_ip?: unknown
          status?: string
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_audit_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_audit_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "agent_api_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_audit_log_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "agent_gateway_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_gateway_operations: {
        Row: {
          action: string
          agent_id: string
          created_at: string
          credential_id: string | null
          error_code: string | null
          error_summary: string | null
          external_id: string | null
          id: string
          idempotency_key: string | null
          payload_hash: string | null
          request_id: string
          result_metadata: Json
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string
          credential_id?: string | null
          error_code?: string | null
          error_summary?: string | null
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          payload_hash?: string | null
          request_id: string
          result_metadata?: Json
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string
          credential_id?: string | null
          error_code?: string | null
          error_summary?: string | null
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          payload_hash?: string | null
          request_id?: string
          result_metadata?: Json
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_gateway_operations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_gateway_operations_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "agent_api_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_gateway_operations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          action: string
          agent_id: string
          created_at: string
          enabled: boolean
          id: string
          rate_limit_per_minute: number
          updated_at: string
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_rate_limit_buckets: {
        Row: {
          action: string
          bucket_start: string
          credential_id: string
          request_count: number
          updated_at: string
          window_seconds: number
        }
        Insert: {
          action: string
          bucket_start: string
          credential_id: string
          request_count?: number
          updated_at?: string
          window_seconds: number
        }
        Update: {
          action?: string
          bucket_start?: string
          credential_id?: string
          request_count?: number
          updated_at?: string
          window_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_rate_limit_buckets_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "agent_api_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          archived: boolean
          assigned_to: string
          completed_at: string | null
          content_capture_eligible: boolean
          context: Json | null
          created_at: string
          created_by: string | null
          deferred_until: string | null
          description: string
          due_date: string | null
          error: string | null
          followers: string[] | null
          goal_id: string | null
          id: string
          is_system_task: boolean
          lease_count: number
          leased_by: string | null
          leased_until: string | null
          notes: string | null
          priority: string
          project_id: string | null
          repo: string | null
          result: string | null
          started_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          assigned_to?: string
          completed_at?: string | null
          content_capture_eligible?: boolean
          context?: Json | null
          created_at?: string
          created_by?: string | null
          deferred_until?: string | null
          description: string
          due_date?: string | null
          error?: string | null
          followers?: string[] | null
          goal_id?: string | null
          id?: string
          is_system_task?: boolean
          lease_count?: number
          leased_by?: string | null
          leased_until?: string | null
          notes?: string | null
          priority?: string
          project_id?: string | null
          repo?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          assigned_to?: string
          completed_at?: string | null
          content_capture_eligible?: boolean
          context?: Json | null
          created_at?: string
          created_by?: string | null
          deferred_until?: string | null
          description?: string
          due_date?: string | null
          error?: string | null
          followers?: string[] | null
          goal_id?: string | null
          id?: string
          is_system_task?: boolean
          lease_count?: number
          leased_by?: string | null
          leased_until?: string | null
          notes?: string | null
          priority?: string
          project_id?: string | null
          repo?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_repo_fkey"
            columns: ["repo"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "agent_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          accent_color: string | null
          accuracy: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_activity: string | null
          emoji: string
          enabled: boolean
          id: string
          last_seen_at: string
          name: string
          position: number
          role: string | null
          skills: string[]
          slug: string
          status: string
          subtitle: string | null
          tasks_completed: number | null
          type: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          accuracy?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_activity?: string | null
          emoji?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string
          name: string
          position?: number
          role?: string | null
          skills?: string[]
          slug: string
          status?: string
          subtitle?: string | null
          tasks_completed?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          accuracy?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_activity?: string | null
          emoji?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string
          name?: string
          position?: number
          role?: string | null
          skills?: string[]
          slug?: string
          status?: string
          subtitle?: string | null
          tasks_completed?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_business_memory: {
        Row: {
          content: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          memory_type: string
          source_message_id: string | null
          source_thread_id: string | null
          title: string
          workspace_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          memory_type: string
          source_message_id?: string | null
          source_thread_id?: string | null
          title: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          memory_type?: string
          source_message_id?: string | null
          source_thread_id?: string | null
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_business_memory_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "ai_strategy_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_business_memory_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "ai_strategy_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          agent_emoji: string | null
          agent_id: string | null
          agent_name: string
          category: string
          created_at: string
          id: string
          message: string
          task_id: string | null
        }
        Insert: {
          agent_emoji?: string | null
          agent_id?: string | null
          agent_name: string
          category: string
          created_at?: string
          id?: string
          message: string
          task_id?: string | null
        }
        Update: {
          agent_emoji?: string | null
          agent_id?: string | null
          agent_name?: string
          category?: string
          created_at?: string
          id?: string
          message?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_project_collaborators: {
        Row: {
          added_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_project_features: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          priority: string
          project_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          priority?: string
          project_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          priority?: string
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_project_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          project_id: string
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_project_links: {
        Row: {
          created_at: string
          id: string
          label: string
          project_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          project_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_projects: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          live_url: string | null
          name: string
          notes_content: string | null
          owner_id: string | null
          platforms: string[]
          prompt: string | null
          repo_url: string | null
          shared_department_ids: string[]
          shared_member_ids: string[]
          stage: string
          tags: string[]
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          live_url?: string | null
          name: string
          notes_content?: string | null
          owner_id?: string | null
          platforms?: string[]
          prompt?: string | null
          repo_url?: string | null
          shared_department_ids?: string[]
          shared_member_ids?: string[]
          stage?: string
          tags?: string[]
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          live_url?: string | null
          name?: string
          notes_content?: string | null
          owner_id?: string | null
          platforms?: string[]
          prompt?: string | null
          repo_url?: string | null
          shared_department_ids?: string[]
          shared_member_ids?: string[]
          stage?: string
          tags?: string[]
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ai_strategy_messages: {
        Row: {
          content: string
          context_snapshot: Json | null
          created_at: string
          id: string
          proposed_tasks: Json | null
          role: string
          saved_to_id: string | null
          saved_to_type: string | null
          tasks_created: boolean
          thread_id: string
        }
        Insert: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          proposed_tasks?: Json | null
          role: string
          saved_to_id?: string | null
          saved_to_type?: string | null
          tasks_created?: boolean
          thread_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          proposed_tasks?: Json | null
          role?: string
          saved_to_id?: string | null
          saved_to_type?: string | null
          tasks_created?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_strategy_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_strategy_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_strategy_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          status: string
          summary: string | null
          summary_updated_at: string | null
          thread_type: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          thread_type?: string
          title?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          thread_type?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      ai_tools: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          id: string
          login_email: string | null
          login_password: string | null
          login_username: string | null
          name: string
          notes: string | null
          updated_at: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          id?: string
          login_email?: string | null
          login_password?: string | null
          login_username?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          login_email?: string | null
          login_password?: string | null
          login_username?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string | null
          author_name: string | null
          banner_color: string | null
          content: string | null
          created_at: string
          department_id: string | null
          id: string
          pinned: boolean | null
          title: string
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          banner_color?: string | null
          content?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          pinned?: boolean | null
          title: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          banner_color?: string | null
          content?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          pinned?: boolean | null
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          token_hash: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          token_hash: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          is_secret: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          is_secret?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          is_secret?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      book_accounts: {
        Row: {
          account_type: string
          code: string
          counterparty_entity_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          id: string
          is_active: boolean
          name: string
          partner_id: string | null
          subtype: string | null
          workspace_id: string
        }
        Insert: {
          account_type: string
          code: string
          counterparty_entity_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          partner_id?: string | null
          subtype?: string | null
          workspace_id: string
        }
        Update: {
          account_type?: string
          code?: string
          counterparty_entity_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          partner_id?: string | null
          subtype?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_accounts_counterparty_entity_id_fkey"
            columns: ["counterparty_entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_accounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "book_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      book_bank_accounts: {
        Row: {
          created_at: string
          display_name: string
          entity_id: string
          gl_account_id: string | null
          id: string
          institution: string
          is_active: boolean
          last_four: string | null
          notes: string | null
          org_label: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          entity_id: string
          gl_account_id?: string | null
          id?: string
          institution?: string
          is_active?: boolean
          last_four?: string | null
          notes?: string | null
          org_label?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          entity_id?: string
          gl_account_id?: string | null
          id?: string
          institution?: string
          is_active?: boolean
          last_four?: string | null
          notes?: string | null
          org_label?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_bank_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "book_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "book_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      book_entities: {
        Row: {
          created_at: string
          ein: string | null
          entity_type: string
          final_tax_year: number | null
          home_state: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          parent_entity_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ein?: string | null
          entity_type?: string
          final_tax_year?: number | null
          home_state?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          parent_entity_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          ein?: string | null
          entity_type?: string
          final_tax_year?: number | null
          home_state?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          parent_entity_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_entities_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      book_entity_partners: {
        Row: {
          effective_from: string | null
          effective_to: string | null
          entity_id: string
          id: string
          notes: string | null
          ownership_pct: number | null
          partner_id: string
          workspace_id: string
        }
        Insert: {
          effective_from?: string | null
          effective_to?: string | null
          entity_id: string
          id?: string
          notes?: string | null
          ownership_pct?: number | null
          partner_id: string
          workspace_id: string
        }
        Update: {
          effective_from?: string | null
          effective_to?: string | null
          entity_id?: string
          id?: string
          notes?: string | null
          ownership_pct?: number | null
          partner_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_entity_partners_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_entity_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "book_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      book_journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entry_date: string
          id: string
          intercompany_group: string | null
          memo: string | null
          source: string
          transaction_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entry_date: string
          id?: string
          intercompany_group?: string | null
          memo?: string | null
          source?: string
          transaction_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entry_date?: string
          id?: string
          intercompany_group?: string | null
          memo?: string | null
          source?: string
          transaction_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_journal_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "book_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      book_journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          entry_id: string
          id: string
          line_no: number | null
          memo: string | null
          partner_id: string | null
          workspace_id: string
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          line_no?: number | null
          memo?: string | null
          partner_id?: string | null
          workspace_id: string
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          line_no?: number | null
          memo?: string | null
          partner_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "book_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "book_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "book_journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "book_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "book_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      book_partners: {
        Row: {
          created_at: string
          id: string
          is_entity: boolean
          legal_name: string | null
          name: string
          notes: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_entity?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_entity?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      book_periods: {
        Row: {
          entity_id: string
          fiscal_year: number
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          entity_id: string
          fiscal_year: number
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          entity_id?: string
          fiscal_year?: number
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_periods_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      book_rules: {
        Row: {
          confidence: number
          created_at: string
          created_by: string | null
          entity_id: string | null
          hit_count: number
          id: string
          is_active: boolean
          last_hit_at: string | null
          match_field: string
          match_pattern: string
          note: string | null
          priority: number
          splits: Json
          treatment: string
          workspace_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit_at?: string | null
          match_field?: string
          match_pattern: string
          note?: string | null
          priority?: number
          splits?: Json
          treatment?: string
          workspace_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit_at?: string | null
          match_field?: string
          match_pattern?: string
          note?: string | null
          priority?: number
          splits?: Json
          treatment?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_rules_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      book_transactions: {
        Row: {
          ai_reasoning: string | null
          amount: number
          bank_account_id: string
          bank_description: string | null
          confidence: number | null
          created_at: string
          description: string
          entity_id: string
          external_id: string | null
          failure_reason: string | null
          id: string
          import_batch: string | null
          memo: string | null
          review_note: string | null
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string | null
          txn_date: string
          workspace_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          amount: number
          bank_account_id: string
          bank_description?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          entity_id: string
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          import_batch?: string | null
          memo?: string | null
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
          txn_date: string
          workspace_id: string
        }
        Update: {
          ai_reasoning?: string | null
          amount?: number
          bank_account_id?: string
          bank_description?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          entity_id?: string
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          import_batch?: string | null
          memo?: string | null
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
          txn_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "book_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_projects: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          title: string
          workspace_id: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          title: string
          workspace_id: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_projects_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bucket_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_holidays: {
        Row: {
          holiday: string
          label: string | null
        }
        Insert: {
          holiday: string
          label?: string | null
        }
        Update: {
          holiday?: string
          label?: string | null
        }
        Relationships: []
      }
      business_plan_decisions: {
        Row: {
          business_plan_id: string
          created_at: string
          decided_by: string | null
          id: string
          text: string
        }
        Insert: {
          business_plan_id: string
          created_at?: string
          decided_by?: string | null
          id?: string
          text: string
        }
        Update: {
          business_plan_id?: string
          created_at?: string
          decided_by?: string | null
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_decisions_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_deliverables: {
        Row: {
          business_plan_id: string
          category: string
          created_at: string
          due_date: string | null
          file_url: string | null
          id: string
          link_url: string | null
          linked_project_id: string | null
          linked_task_id: string | null
          owner_id: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_plan_id: string
          category?: string
          created_at?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          linked_project_id?: string | null
          linked_task_id?: string | null
          owner_id?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_plan_id?: string
          category?: string
          created_at?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          linked_project_id?: string | null
          linked_task_id?: string | null
          owner_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_deliverables_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_plan_deliverables_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_plan_deliverables_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_milestones: {
        Row: {
          business_plan_id: string
          created_at: string
          done: boolean
          due_date: string | null
          goal_id: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          business_plan_id: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          goal_id?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          business_plan_id?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          goal_id?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_milestones_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_plan_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_risks: {
        Row: {
          business_plan_id: string
          created_at: string
          id: string
          severity: string
          sort_order: number
          text: string
          updated_at: string
        }
        Insert: {
          business_plan_id: string
          created_at?: string
          id?: string
          severity?: string
          sort_order?: number
          text: string
          updated_at?: string
        }
        Update: {
          business_plan_id?: string
          created_at?: string
          id?: string
          severity?: string
          sort_order?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_risks_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_roles: {
        Row: {
          assigned_user_id: string | null
          business_plan_id: string
          created_at: string
          id: string
          notes: string | null
          role_title: string
          sort_order: number
        }
        Insert: {
          assigned_user_id?: string | null
          business_plan_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role_title: string
          sort_order?: number
        }
        Update: {
          assigned_user_id?: string | null
          business_plan_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role_title?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_roles_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          one_liner: string | null
          owner_id: string | null
          plan_doc: string
          priority: string
          purpose: string | null
          shared_with: Json
          status: string
          title: string
          type: string | null
          updated_at: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          one_liner?: string | null
          owner_id?: string | null
          plan_doc?: string
          priority?: string
          purpose?: string | null
          shared_with?: Json
          status?: string
          title: string
          type?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          one_liner?: string | null
          owner_id?: string | null
          plan_doc?: string
          priority?: string
          purpose?: string | null
          shared_with?: Json
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_box_criteria: {
        Row: {
          active: boolean
          asset_class: string
          created_at: string
          field: string
          hardness: string
          id: string
          label: string
          notes: string | null
          operator: string
          rule_type: string
          updated_at: string
          value: Json
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          asset_class: string
          created_at?: string
          field: string
          hardness?: string
          id?: string
          label: string
          notes?: string | null
          operator: string
          rule_type?: string
          updated_at?: string
          value: Json
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          asset_class?: string
          created_at?: string
          field?: string
          hardness?: string
          id?: string
          label?: string
          notes?: string | null
          operator?: string
          rule_type?: string
          updated_at?: string
          value?: Json
          workspace_id?: string | null
        }
        Relationships: []
      }
      buy_box_exceptions: {
        Row: {
          active: boolean
          adjustment: string | null
          asset_class: string
          condition: string
          created_at: string
          exception_type: string
          id: string
          label: string
          requires_human: boolean
          triggers_on: string | null
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          adjustment?: string | null
          asset_class: string
          condition: string
          created_at?: string
          exception_type: string
          id?: string
          label: string
          requires_human?: boolean
          triggers_on?: string | null
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          adjustment?: string | null
          asset_class?: string
          condition?: string
          created_at?: string
          exception_type?: string
          id?: string
          label?: string
          requires_human?: boolean
          triggers_on?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      cadence_runs: {
        Row: {
          cadence_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          generated_task_id: string | null
          id: string
          note: string | null
          status: string
        }
        Insert: {
          cadence_id: string
          completed_at?: string | null
          created_at?: string
          due_date: string
          generated_task_id?: string | null
          id?: string
          note?: string | null
          status?: string
        }
        Update: {
          cadence_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          generated_task_id?: string | null
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_runs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_runs_generated_task_id_fkey"
            columns: ["generated_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          business_plan_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          owner_id: string | null
          schedule_config: Json
          schedule_type: string
          sop_doc_id: string | null
          task_template: Json
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          business_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          owner_id?: string | null
          schedule_config?: Json
          schedule_type?: string
          sop_doc_id?: string | null
          task_template?: Json
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          business_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          owner_id?: string | null
          schedule_config?: Json
          schedule_type?: string
          sop_doc_id?: string | null
          task_template?: Json
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadences_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadences_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_guide_app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      call_guide_property_questions: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_guide_scripts: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_activation_signals: {
        Row: {
          activated_at: string
          activation_count: number
          candidate_id: string | null
          cash_work_item_id: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          ghl_opportunity_id: string
          id: string
          live_snapshot: Json
          source_stage_event_id: string
          stale_at: string | null
          stale_reason: string | null
          state: string
          trigger_pipeline_id: string
          trigger_stage_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activated_at: string
          activation_count: number
          candidate_id?: string | null
          cash_work_item_id?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          ghl_opportunity_id: string
          id?: string
          live_snapshot?: Json
          source_stage_event_id: string
          stale_at?: string | null
          stale_reason?: string | null
          state?: string
          trigger_pipeline_id: string
          trigger_stage_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activated_at?: string
          activation_count?: number
          candidate_id?: string | null
          cash_work_item_id?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          ghl_opportunity_id?: string
          id?: string
          live_snapshot?: Json
          source_stage_event_id?: string
          stale_at?: string | null
          stale_reason?: string | null
          state?: string
          trigger_pipeline_id?: string
          trigger_stage_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_activation_signals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_activation_signals_cash_work_item_id_fkey"
            columns: ["cash_work_item_id"]
            isOneToOne: false
            referencedRelation: "cash_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_activation_signals_source_stage_event_id_fkey"
            columns: ["source_stage_event_id"]
            isOneToOne: false
            referencedRelation: "ghl_stage_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_activation_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_underwriting_steps: {
        Row: {
          activation_count: number
          agent_task_id: string
          candidate_id: string | null
          cash_work_item_id: string
          created_at: string
          ghl_opportunity_id: string
          id: string
          output: Json
          phase: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activation_count: number
          agent_task_id: string
          candidate_id?: string | null
          cash_work_item_id: string
          created_at?: string
          ghl_opportunity_id: string
          id?: string
          output?: Json
          phase: string
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activation_count?: number
          agent_task_id?: string
          candidate_id?: string | null
          cash_work_item_id?: string
          created_at?: string
          ghl_opportunity_id?: string
          id?: string
          output?: Json
          phase?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_underwriting_steps_agent_task_id_fkey"
            columns: ["agent_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_underwriting_steps_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_underwriting_steps_cash_work_item_id_fkey"
            columns: ["cash_work_item_id"]
            isOneToOne: false
            referencedRelation: "cash_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_underwriting_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_work_items: {
        Row: {
          activation_count: number
          agent_task_id: string
          candidate_id: string | null
          claim_lease_expires_at: string | null
          claim_lease_token: string | null
          created_at: string
          first_activated_at: string
          ghl_opportunity_id: string
          id: string
          last_activated_at: string
          last_event_id: string | null
          state: string
          trigger_pipeline_id: string
          trigger_stage_id: string
          updated_at: string
          work_kind: string
          workspace_id: string
        }
        Insert: {
          activation_count?: number
          agent_task_id: string
          candidate_id?: string | null
          claim_lease_expires_at?: string | null
          claim_lease_token?: string | null
          created_at?: string
          first_activated_at?: string
          ghl_opportunity_id: string
          id?: string
          last_activated_at?: string
          last_event_id?: string | null
          state?: string
          trigger_pipeline_id: string
          trigger_stage_id: string
          updated_at?: string
          work_kind: string
          workspace_id: string
        }
        Update: {
          activation_count?: number
          agent_task_id?: string
          candidate_id?: string | null
          claim_lease_expires_at?: string | null
          claim_lease_token?: string | null
          created_at?: string
          first_activated_at?: string
          ghl_opportunity_id?: string
          id?: string
          last_activated_at?: string
          last_event_id?: string | null
          state?: string
          trigger_pipeline_id?: string
          trigger_stage_id?: string
          updated_at?: string
          work_kind?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_work_items_agent_task_id_fkey"
            columns: ["agent_task_id"]
            isOneToOne: true
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_work_items_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_work_items_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "ghl_stage_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_work_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_scratch_pad: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ceo_scratch_pad_archive: {
        Row: {
          content: string
          created_at: string
          id: string
          triaged_count: number
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          triaged_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          triaged_count?: number
          user_id?: string
        }
        Relationships: []
      }
      ceo_triage_pending: {
        Row: {
          category: string
          created_at: string
          id: string
          reasoning: string
          source_archive_id: string | null
          suggested_assignee_id: string | null
          suggested_priority: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          reasoning?: string
          source_archive_id?: string | null
          suggested_assignee_id?: string | null
          suggested_priority?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          reasoning?: string
          source_archive_id?: string | null
          suggested_assignee_id?: string | null
          suggested_priority?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_triage_pending_source_archive_id_fkey"
            columns: ["source_archive_id"]
            isOneToOne: false
            referencedRelation: "ceo_scratch_pad_archive"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          agent_name: string | null
          attachments: Json
          audio_url: string | null
          author_id: string
          content: string
          content_html: string | null
          created_at: string
          entity_id: string
          entity_type: string
          gif_url: string | null
          id: string
          mentions: Json
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          agent_name?: string | null
          attachments?: Json
          audio_url?: string | null
          author_id: string
          content?: string
          content_html?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          gif_url?: string | null
          id?: string
          mentions?: Json
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_name?: string | null
          attachments?: Json
          audio_url?: string | null
          author_id?: string
          content?: string
          content_html?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          gif_url?: string | null
          id?: string
          mentions?: Json
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: Json
          created_at: string
          created_by: string | null
          custom_fields: Json
          domain: string | null
          id: string
          industry: string | null
          name: string
          notes: string
          owner_id: string | null
          size: string | null
          tags: string[]
          updated_at: string
          website: string | null
          workspace_id: string | null
        }
        Insert: {
          address?: Json
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          domain?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string
          owner_id?: string | null
          size?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
          workspace_id?: string | null
        }
        Update: {
          address?: Json
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          domain?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string
          owner_id?: string | null
          size?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      contact_review_batches: {
        Row: {
          completed_at: string | null
          contacts_fetched: number
          contacts_queued: number
          contacts_skipped: number
          error: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          completed_at?: string | null
          contacts_fetched?: number
          contacts_queued?: number
          contacts_skipped?: number
          error?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          completed_at?: string | null
          contacts_fetched?: number
          contacts_queued?: number
          contacts_skipped?: number
          error?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      contact_review_queue: {
        Row: {
          applied_at: string | null
          apply_error: string | null
          batch_id: string
          confidence: number
          contact_name: string | null
          contact_type: string
          conversation_snippet: Json
          created_at: string
          current_status_label: string
          current_status_tag: string
          ghl_contact_id: string
          id: string
          phone: string | null
          reasoning: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          suggested_status_label: string
          suggested_status_tag: string
        }
        Insert: {
          applied_at?: string | null
          apply_error?: string | null
          batch_id: string
          confidence: number
          contact_name?: string | null
          contact_type: string
          conversation_snippet?: Json
          created_at?: string
          current_status_label: string
          current_status_tag: string
          ghl_contact_id: string
          id?: string
          phone?: string | null
          reasoning: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          suggested_status_label: string
          suggested_status_tag: string
        }
        Update: {
          applied_at?: string | null
          apply_error?: string | null
          batch_id?: string
          confidence?: number
          contact_name?: string | null
          contact_type?: string
          conversation_snippet?: Json
          created_at?: string
          current_status_label?: string
          current_status_tag?: string
          ghl_contact_id?: string
          id?: string
          phone?: string | null
          reasoning?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          suggested_status_label?: string
          suggested_status_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_review_queue_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "contact_review_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: Json
          buy_box_notes: string | null
          company_id: string | null
          contact_type: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          department_id: string | null
          email: string | null
          first_name: string
          ghl_contact_id: string | null
          id: string
          is_active: boolean
          last_contacted_at: string | null
          last_name: string
          markets: string[] | null
          notes: string
          owner_id: string | null
          phone: string | null
          preferred_contact_method: string | null
          social: Json
          source: string | null
          status: string
          tags: string[]
          title: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          address?: Json
          buy_box_notes?: string | null
          company_id?: string | null
          contact_type?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          department_id?: string | null
          email?: string | null
          first_name?: string
          ghl_contact_id?: string | null
          id?: string
          is_active?: boolean
          last_contacted_at?: string | null
          last_name?: string
          markets?: string[] | null
          notes?: string
          owner_id?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          social?: Json
          source?: string | null
          status?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          address?: Json
          buy_box_notes?: string | null
          company_id?: string | null
          contact_type?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          department_id?: string | null
          email?: string | null
          first_name?: string
          ghl_contact_id?: string | null
          id?: string
          is_active?: boolean
          last_contacted_at?: string | null
          last_name?: string
          markets?: string[] | null
          notes?: string
          owner_id?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          social?: Json
          source?: string | null
          status?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      content_brands: {
        Row: {
          audience: string
          canva_kit_id: string | null
          color: string
          created_at: string
          id: string
          mission: string
          name: string
          seeds: Json
          sort_order: number
          updated_at: string
          user_id: string
          voice: string
          workspace_id: string | null
        }
        Insert: {
          audience?: string
          canva_kit_id?: string | null
          color?: string
          created_at?: string
          id?: string
          mission?: string
          name: string
          seeds?: Json
          sort_order?: number
          updated_at?: string
          user_id: string
          voice?: string
          workspace_id?: string | null
        }
        Update: {
          audience?: string
          canva_kit_id?: string | null
          color?: string
          created_at?: string
          id?: string
          mission?: string
          name?: string
          seeds?: Json
          sort_order?: number
          updated_at?: string
          user_id?: string
          voice?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      content_library: {
        Row: {
          brand_color: string
          brand_id: string | null
          brand_name: string
          canva_url: string | null
          clip_range: string | null
          content: string
          created_at: string
          created_by_agent_id: string | null
          id: string
          image_url: string | null
          pillar_id: string | null
          platform: string
          platform_label: string
          review_assignee: string | null
          seed: string
          seed_id: string | null
          source_video_url: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          brand_color?: string
          brand_id?: string | null
          brand_name?: string
          canva_url?: string | null
          clip_range?: string | null
          content?: string
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          image_url?: string | null
          pillar_id?: string | null
          platform?: string
          platform_label?: string
          review_assignee?: string | null
          seed?: string
          seed_id?: string | null
          source_video_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          brand_color?: string
          brand_id?: string | null
          brand_name?: string
          canva_url?: string | null
          clip_range?: string | null
          content?: string
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          image_url?: string | null
          pillar_id?: string | null
          platform?: string
          platform_label?: string
          review_assignee?: string | null
          seed?: string
          seed_id?: string | null
          source_video_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_library_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "content_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_library_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_library_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "content_seeds"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          brand_id: string
          created_at: string
          framing_note: string | null
          id: string
          key: string
          label: string
          sort_order: number
          target_pct: number
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          framing_note?: string | null
          id?: string
          key: string
          label: string
          sort_order?: number
          target_pct: number
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          framing_note?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number
          target_pct?: number
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_pillars_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "content_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pillars_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_research: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by_agent_id: string | null
          expires_at: string | null
          finding: string
          id: string
          is_sourced: boolean
          source_task_id: string | null
          source_url: string | null
          topic: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          expires_at?: string | null
          finding: string
          id?: string
          is_sourced?: boolean
          source_task_id?: string | null
          source_url?: string | null
          topic: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          expires_at?: string | null
          finding?: string
          id?: string
          is_sourced?: boolean
          source_task_id?: string | null
          source_url?: string | null
          topic?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_research_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "content_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_research_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_research_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_schedule: {
        Row: {
          brand_id: string | null
          content_id: string
          created_at: string
          created_by_agent_id: string | null
          failure_reason: string | null
          id: string
          metrics: Json | null
          platform: string
          published_url: string | null
          rejection_reason: string | null
          released_at: string | null
          released_by: string | null
          review_assignee: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          content_id: string
          created_at?: string
          created_by_agent_id?: string | null
          failure_reason?: string | null
          id?: string
          metrics?: Json | null
          platform: string
          published_url?: string | null
          rejection_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          review_assignee?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          content_id?: string
          created_at?: string
          created_by_agent_id?: string | null
          failure_reason?: string | null
          id?: string
          metrics?: Json | null
          platform?: string
          published_url?: string | null
          rejection_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          review_assignee?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_schedule_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "content_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_schedule_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_schedule_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_seeds: {
        Row: {
          angle: string | null
          brand_id: string | null
          created_at: string
          created_by_agent_id: string | null
          id: string
          pillar_id: string | null
          raw: string
          score: number
          source: string
          source_ref: string | null
          source_task_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          angle?: string | null
          brand_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          pillar_id?: string | null
          raw: string
          score?: number
          source: string
          source_ref?: string | null
          source_task_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          angle?: string | null
          brand_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          pillar_id?: string | null
          raw?: string
          score?: number
          source?: string
          source_ref?: string | null
          source_task_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_seeds_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "content_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_seeds_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_seeds_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_seeds_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_voice_exemplars: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          brand_id: string
          created_at: string
          id: string
          is_positive: boolean
          platform: string | null
          proposed_by_agent_id: string | null
          status: string
          text: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          brand_id: string
          created_at?: string
          id?: string
          is_positive?: boolean
          platform?: string | null
          proposed_by_agent_id?: string | null
          status?: string
          text: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          is_positive?: boolean
          platform?: string | null
          proposed_by_agent_id?: string | null
          status?: string
          text?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_voice_exemplars_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "content_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_voice_exemplars_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      council_messages: {
        Row: {
          agent_emoji: string | null
          agent_id: string | null
          agent_name: string
          body: string
          created_at: string
          id: string
          position: number
          session_id: string
        }
        Insert: {
          agent_emoji?: string | null
          agent_id?: string | null
          agent_name: string
          body: string
          created_at?: string
          id?: string
          position: number
          session_id: string
        }
        Update: {
          agent_emoji?: string | null
          agent_id?: string | null
          agent_name?: string
          body?: string
          created_at?: string
          id?: string
          position?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "council_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      council_sessions: {
        Row: {
          created_at: string
          id: string
          participants: Json
          question: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          participants?: Json
          question: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          participants?: Json
          question?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          duration_minutes: number | null
          entity_id: string
          entity_type: string
          id: string
          is_pinned: boolean
          metadata: Json
          occurred_at: string
          subject: string
          type: string
          workspace_id: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          duration_minutes?: number | null
          entity_id: string
          entity_type: string
          id?: string
          is_pinned?: boolean
          metadata?: Json
          occurred_at?: string
          subject?: string
          type: string
          workspace_id?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          duration_minutes?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_pinned?: boolean
          metadata?: Json
          occurred_at?: string
          subject?: string
          type?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      crm_custom_fields: {
        Row: {
          contact_type: string | null
          created_at: string
          created_by: string | null
          entity_type: string
          field_key: string
          field_type: string
          id: string
          is_deletable: boolean
          is_template: boolean
          label: string
          options: Json
          required: boolean
          sort_order: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          contact_type?: string | null
          created_at?: string
          created_by?: string | null
          entity_type: string
          field_key: string
          field_type: string
          id?: string
          is_deletable?: boolean
          is_template?: boolean
          label: string
          options?: Json
          required?: boolean
          sort_order?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          contact_type?: string | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          field_key?: string
          field_type?: string
          id?: string
          is_deletable?: boolean
          is_template?: boolean
          label?: string
          options?: Json
          required?: boolean
          sort_order?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_custom_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_transactions: {
        Row: {
          actual_net: number | null
          address_private: boolean
          asking_price: number | null
          assignment_fee: number | null
          assignment_signed_at: string | null
          attorney_contact_id: string | null
          best_exit: string | null
          buyer_contact_id: string | null
          buyer_emd_received_at: string | null
          buyer_id: string | null
          closing_date: string | null
          contract_date: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deal_id: string | null
          dispo_manager_id: string | null
          disposition_strategy: string | null
          due_diligence_end: string | null
          earnest_money_received: boolean
          earnest_money_received_date: string | null
          earnest_money_required: number | null
          emd_due_date: string | null
          estimated_net: number | null
          fully_executed_date: string | null
          ghl_contact_id: string | null
          ghl_opportunity_id: string | null
          ghl_opportunity_name: string | null
          ghl_synced_at: string | null
          id: string
          inspection_deadline: string | null
          lane: string
          lender_contact_id: string | null
          marketing_title: string | null
          next_action: string | null
          notes: string
          owner_id: string | null
          primary_contact_id: string | null
          property_address: string | null
          property_city: string | null
          property_county_metro: string | null
          property_state: string | null
          property_type: string | null
          property_zip: string | null
          published: boolean
          published_at: string | null
          purchase_price: number | null
          slug: string | null
          source_contact_id: string | null
          stage: string | null
          status: string
          title_contact_id: string | null
          transaction_type: string
          unit_mix: string | null
          units: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          actual_net?: number | null
          address_private?: boolean
          asking_price?: number | null
          assignment_fee?: number | null
          assignment_signed_at?: string | null
          attorney_contact_id?: string | null
          best_exit?: string | null
          buyer_contact_id?: string | null
          buyer_emd_received_at?: string | null
          buyer_id?: string | null
          closing_date?: string | null
          contract_date?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deal_id?: string | null
          dispo_manager_id?: string | null
          disposition_strategy?: string | null
          due_diligence_end?: string | null
          earnest_money_received?: boolean
          earnest_money_received_date?: string | null
          earnest_money_required?: number | null
          emd_due_date?: string | null
          estimated_net?: number | null
          fully_executed_date?: string | null
          ghl_contact_id?: string | null
          ghl_opportunity_id?: string | null
          ghl_opportunity_name?: string | null
          ghl_synced_at?: string | null
          id?: string
          inspection_deadline?: string | null
          lane?: string
          lender_contact_id?: string | null
          marketing_title?: string | null
          next_action?: string | null
          notes?: string
          owner_id?: string | null
          primary_contact_id?: string | null
          property_address?: string | null
          property_city?: string | null
          property_county_metro?: string | null
          property_state?: string | null
          property_type?: string | null
          property_zip?: string | null
          published?: boolean
          published_at?: string | null
          purchase_price?: number | null
          slug?: string | null
          source_contact_id?: string | null
          stage?: string | null
          status?: string
          title_contact_id?: string | null
          transaction_type?: string
          unit_mix?: string | null
          units?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          actual_net?: number | null
          address_private?: boolean
          asking_price?: number | null
          assignment_fee?: number | null
          assignment_signed_at?: string | null
          attorney_contact_id?: string | null
          best_exit?: string | null
          buyer_contact_id?: string | null
          buyer_emd_received_at?: string | null
          buyer_id?: string | null
          closing_date?: string | null
          contract_date?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deal_id?: string | null
          dispo_manager_id?: string | null
          disposition_strategy?: string | null
          due_diligence_end?: string | null
          earnest_money_received?: boolean
          earnest_money_received_date?: string | null
          earnest_money_required?: number | null
          emd_due_date?: string | null
          estimated_net?: number | null
          fully_executed_date?: string | null
          ghl_contact_id?: string | null
          ghl_opportunity_id?: string | null
          ghl_opportunity_name?: string | null
          ghl_synced_at?: string | null
          id?: string
          inspection_deadline?: string | null
          lane?: string
          lender_contact_id?: string | null
          marketing_title?: string | null
          next_action?: string | null
          notes?: string
          owner_id?: string | null
          primary_contact_id?: string | null
          property_address?: string | null
          property_city?: string | null
          property_county_metro?: string | null
          property_state?: string | null
          property_type?: string | null
          property_zip?: string | null
          published?: boolean
          published_at?: string | null
          purchase_price?: number | null
          slug?: string | null
          source_contact_id?: string | null
          stage?: string | null
          status?: string
          title_contact_id?: string | null
          transaction_type?: string
          unit_mix?: string | null
          units?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_transactions_attorney_contact_id_fkey"
            columns: ["attorney_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_buyer_contact_id_fkey"
            columns: ["buyer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "dispo_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_dispo_manager_id_fkey"
            columns: ["dispo_manager_id"]
            isOneToOne: false
            referencedRelation: "dispo_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_lender_contact_id_fkey"
            columns: ["lender_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_title_contact_id_fkey"
            columns: ["title_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefings: {
        Row: {
          briefing_date: string
          bullets: Json
          created_at: string
          focus: string
          generated_at: string
          id: string
          read_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          briefing_date: string
          bullets?: Json
          created_at?: string
          focus?: string
          generated_at?: string
          id?: string
          read_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          briefing_date?: string
          bullets?: Json
          created_at?: string
          focus?: string
          generated_at?: string
          id?: string
          read_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_priorities: {
        Row: {
          created_at: string
          id: string
          mentions: Json | null
          priority_date: string
          slot: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentions?: Json | null
          priority_date: string
          slot: number
          text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentions?: Json | null
          priority_date?: string
          slot?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      database_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          database_id: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          database_id: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          database_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "database_api_keys_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases_meta"
            referencedColumns: ["id"]
          },
        ]
      }
      database_forms: {
        Row: {
          created_at: string
          created_by: string | null
          database_id: string
          description: string
          fields: Json
          id: string
          is_active: boolean
          slug: string
          submit_message: string
          title: string
          updated_at: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          database_id: string
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          slug: string
          submit_message?: string
          title: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          database_id?: string
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          slug?: string
          submit_message?: string
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "database_forms_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases_meta"
            referencedColumns: ["id"]
          },
        ]
      }
      database_rows: {
        Row: {
          created_at: string
          database_id: string
          id: string
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          database_id: string
          id?: string
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          database_id?: string
          id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "database_rows_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases_meta"
            referencedColumns: ["id"]
          },
        ]
      }
      database_views: {
        Row: {
          column_order: string[]
          created_at: string
          created_by: string | null
          database_id: string
          filters: Json
          group_by: string | null
          id: string
          name: string
          sorts: Json
          updated_at: string
          view_type: string
        }
        Insert: {
          column_order?: string[]
          created_at?: string
          created_by?: string | null
          database_id: string
          filters?: Json
          group_by?: string | null
          id?: string
          name: string
          sorts?: Json
          updated_at?: string
          view_type?: string
        }
        Update: {
          column_order?: string[]
          created_at?: string
          created_by?: string | null
          database_id?: string
          filters?: Json
          group_by?: string | null
          id?: string
          name?: string
          sorts?: Json
          updated_at?: string
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "database_views_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases_meta"
            referencedColumns: ["id"]
          },
        ]
      }
      database_webhook_deliveries: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          payload: Json
          response_body: string | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "database_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "database_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      database_webhooks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          database_id: string
          direction: string
          events: string[]
          id: string
          label: string
          last_delivered_at: string | null
          last_status: number | null
          secret: string
          updated_at: string
          url: string | null
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          database_id: string
          direction?: string
          events?: string[]
          id?: string
          label?: string
          last_delivered_at?: string | null
          last_status?: number | null
          secret: string
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          database_id?: string
          direction?: string
          events?: string[]
          id?: string
          label?: string
          last_delivered_at?: string | null
          last_status?: number | null
          secret?: string
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "database_webhooks_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases_meta"
            referencedColumns: ["id"]
          },
        ]
      }
      databases_meta: {
        Row: {
          columns: Json
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          icon: string | null
          id: string
          shared_with: Json | null
          title: string
          updated_at: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          shared_with?: Json | null
          title: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          shared_with?: Json | null
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "databases_meta_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_analyzer_deal_shares: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          permission: string
          shared_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          permission?: string
          shared_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          permission?: string
          shared_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_analyzer_deal_shares_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_analyzer_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_analyzer_deals: {
        Row: {
          analyzer_inputs: Json
          analyzer_results: Json
          capital_stack_inputs: Json
          capital_stack_results: Json
          created_at: string
          created_by: string | null
          id: string
          is_saved: boolean
          name: string
          notes: string
          offer_inputs: Json
          offer_results: Json
          returns_inputs: Json
          returns_results: Json
          status: string
          updated_at: string
        }
        Insert: {
          analyzer_inputs?: Json
          analyzer_results?: Json
          capital_stack_inputs?: Json
          capital_stack_results?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_saved?: boolean
          name?: string
          notes?: string
          offer_inputs?: Json
          offer_results?: Json
          returns_inputs?: Json
          returns_results?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          analyzer_inputs?: Json
          analyzer_results?: Json
          capital_stack_inputs?: Json
          capital_stack_results?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_saved?: boolean
          name?: string
          notes?: string
          offer_inputs?: Json
          offer_results?: Json
          returns_inputs?: Json
          returns_results?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_analyzer_documents: {
        Row: {
          applied: boolean
          created_at: string
          deal_id: string
          extracted_data: Json | null
          extraction_error: string | null
          extraction_status: string
          file_name: string
          file_type: string
          id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          deal_id: string
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_status?: string
          file_name: string
          file_type: string
          id?: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          deal_id?: string
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_status?: string
          file_name?: string
          file_type?: string
          id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_analyzer_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_analyzer_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_analyzer_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_deadline_pings: {
        Row: {
          bucket: string
          created_at: string
          deadline_key: string
          due_date: string
          id: string
          transaction_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          deadline_key: string
          due_date: string
          id?: string
          transaction_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          deadline_key?: string
          due_date?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_deadline_pings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_deadline_pings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          created_at: string
          doc_type: string
          extracted: Json | null
          extraction_status: string | null
          file_name: string
          id: string
          mime: string | null
          size_bytes: number | null
          storage_path: string
          transaction_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          extracted?: Json | null
          extraction_status?: string | null
          file_name: string
          id?: string
          mime?: string | null
          size_bytes?: number | null
          storage_path: string
          transaction_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          extracted?: Json | null
          extraction_status?: string | null
          file_name?: string
          id?: string
          mime?: string | null
          size_bytes?: number | null
          storage_path?: string
          transaction_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_bookings: {
        Row: {
          contract_amount: number | null
          created_at: string
          deal_room_id: string
          event_date: string | null
          event_name: string
          id: string
          notes: string | null
          remaining_due: number | null
          seller_collected: number | null
          vendor_cost: number | null
        }
        Insert: {
          contract_amount?: number | null
          created_at?: string
          deal_room_id: string
          event_date?: string | null
          event_name: string
          id?: string
          notes?: string | null
          remaining_due?: number | null
          seller_collected?: number | null
          vendor_cost?: number | null
        }
        Update: {
          contract_amount?: number | null
          created_at?: string
          deal_room_id?: string
          event_date?: string | null
          event_name?: string
          id?: string
          notes?: string | null
          remaining_due?: number | null
          seller_collected?: number | null
          vendor_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_bookings_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_dd_items: {
        Row: {
          category: string
          created_at: string
          deal_room_id: string
          doc_url: string | null
          due_date: string | null
          id: string
          notes: string | null
          owner_name: string | null
          risk: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          deal_room_id: string
          doc_url?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          risk?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deal_room_id?: string
          doc_url?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          risk?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_dd_items_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_decisions: {
        Row: {
          created_at: string
          deal_room_id: string
          decided_at: string
          decided_by: string | null
          id: string
          summary: string
        }
        Insert: {
          created_at?: string
          deal_room_id: string
          decided_at?: string
          decided_by?: string | null
          id?: string
          summary: string
        }
        Update: {
          created_at?: string
          deal_room_id?: string
          decided_at?: string
          decided_by?: string | null
          id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_decisions_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_investors: {
        Row: {
          amount: number | null
          deal_room_id: string
          id: string
          investor_name: string
          multiple_offered: number | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          deal_room_id: string
          id?: string
          investor_name: string
          multiple_offered?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          deal_room_id?: string
          id?: string
          investor_name?: string
          multiple_offered?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_investors_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_risks: {
        Row: {
          created_at: string
          deal_room_id: string
          description: string | null
          id: string
          owner_name: string | null
          severity: string
          title: string
        }
        Insert: {
          created_at?: string
          deal_room_id: string
          description?: string | null
          id?: string
          owner_name?: string | null
          severity?: string
          title: string
        }
        Update: {
          created_at?: string
          deal_room_id?: string
          description?: string | null
          id?: string
          owner_name?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_risks_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_rooms: {
        Row: {
          business_price: number | null
          capital_raise_target: number | null
          cash_at_closing: number | null
          created_at: string
          created_by: string | null
          id: string
          investor_multiple_max: number | null
          investor_multiple_min: number | null
          linked_deal_id: string | null
          name: string
          purchase_price: number | null
          real_estate_price: number | null
          seller_financing_amount: number | null
          seller_financing_terms: string | null
          status: string
          target_close_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_price?: number | null
          capital_raise_target?: number | null
          cash_at_closing?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          investor_multiple_max?: number | null
          investor_multiple_min?: number | null
          linked_deal_id?: string | null
          name: string
          purchase_price?: number | null
          real_estate_price?: number | null
          seller_financing_amount?: number | null
          seller_financing_terms?: string | null
          status?: string
          target_close_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_price?: number | null
          capital_raise_target?: number | null
          cash_at_closing?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          investor_multiple_max?: number | null
          investor_multiple_min?: number | null
          linked_deal_id?: string | null
          name?: string
          purchase_price?: number | null
          real_estate_price?: number | null
          seller_financing_amount?: number | null
          seller_financing_terms?: string | null
          status?: string
          target_close_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_rooms_linked_deal_id_fkey"
            columns: ["linked_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          asking_price: number | null
          broker_feedback: string | null
          company_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          custom_fields: Json
          department_id: string | null
          description: string
          disposition_strategy: string | null
          effective_gross_income: number | null
          expected_close_date: string | null
          gross_income: number | null
          id: string
          lane: string
          lead_id: string | null
          listed_cap_rate: number | null
          loi_amount: number | null
          loi_date: string | null
          lost_reason: string | null
          mao: number | null
          noi: number | null
          operating_expenses: number | null
          our_cap_rate: number | null
          our_value: number | null
          owner_id: string | null
          pipeline_id: string
          price_per_unit: number | null
          primary_contact_id: string | null
          probability: number
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_type: string | null
          property_zip: string | null
          quick_arv: number | null
          repair_estimate: number | null
          seller_stated_value: number | null
          source_contact_id: string | null
          spread: number | null
          stage_entered_at: string | null
          stage_id: string
          status: string
          tags: string[]
          title: string
          unit_mix: string | null
          units: number | null
          updated_at: string
          vacancy_rate: number | null
          value: number
          workspace_id: string | null
        }
        Insert: {
          asking_price?: number | null
          broker_feedback?: string | null
          company_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: Json
          department_id?: string | null
          description?: string
          disposition_strategy?: string | null
          effective_gross_income?: number | null
          expected_close_date?: string | null
          gross_income?: number | null
          id?: string
          lane?: string
          lead_id?: string | null
          listed_cap_rate?: number | null
          loi_amount?: number | null
          loi_date?: string | null
          lost_reason?: string | null
          mao?: number | null
          noi?: number | null
          operating_expenses?: number | null
          our_cap_rate?: number | null
          our_value?: number | null
          owner_id?: string | null
          pipeline_id: string
          price_per_unit?: number | null
          primary_contact_id?: string | null
          probability?: number
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_type?: string | null
          property_zip?: string | null
          quick_arv?: number | null
          repair_estimate?: number | null
          seller_stated_value?: number | null
          source_contact_id?: string | null
          spread?: number | null
          stage_entered_at?: string | null
          stage_id: string
          status?: string
          tags?: string[]
          title: string
          unit_mix?: string | null
          units?: number | null
          updated_at?: string
          vacancy_rate?: number | null
          value?: number
          workspace_id?: string | null
        }
        Update: {
          asking_price?: number | null
          broker_feedback?: string | null
          company_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: Json
          department_id?: string | null
          description?: string
          disposition_strategy?: string | null
          effective_gross_income?: number | null
          expected_close_date?: string | null
          gross_income?: number | null
          id?: string
          lane?: string
          lead_id?: string | null
          listed_cap_rate?: number | null
          loi_amount?: number | null
          loi_date?: string | null
          lost_reason?: string | null
          mao?: number | null
          noi?: number | null
          operating_expenses?: number | null
          our_cap_rate?: number | null
          our_value?: number | null
          owner_id?: string | null
          pipeline_id?: string
          price_per_unit?: number | null
          primary_contact_id?: string | null
          probability?: number
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_type?: string | null
          property_zip?: string | null
          quick_arv?: number | null
          repair_estimate?: number | null
          seller_stated_value?: number | null
          source_contact_id?: string | null
          spread?: number | null
          stage_entered_at?: string | null
          stage_id?: string
          status?: string
          tags?: string[]
          title?: string
          unit_mix?: string | null
          units?: number | null
          updated_at?: string
          vacancy_rate?: number | null
          value?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_log: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          outcome: string | null
          rationale: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          outcome?: string | null
          rationale?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          outcome?: string | null
          rationale?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_pinboard: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_id: string
          description: string | null
          icon: string | null
          id: string
          sort_order: number | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_id: string
          description?: string | null
          icon?: string | null
          id?: string
          sort_order?: number | null
          title: string
          type?: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string
          description?: string | null
          icon?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_program: boolean
          name: string
          sort_order: number | null
          template_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_program?: boolean
          name: string
          sort_order?: number | null
          template_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_program?: boolean
          name?: string
          sort_order?: number | null
          template_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dept_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dept_focus_cache: {
        Row: {
          department_id: string
          generated_at: string
          generated_by: string | null
          id: string
          priorities: Json
          week_start_date: string
        }
        Insert: {
          department_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          priorities?: Json
          week_start_date: string
        }
        Update: {
          department_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          priorities?: Json
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "dept_focus_cache_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      dept_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id: string
          is_system?: boolean
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dept_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      directive_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          author_role: string
          body: string
          created_at: string
          department_id: string | null
          id: string
          mentions: Json
          strategy_item_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          department_id?: string | null
          id?: string
          mentions?: Json
          strategy_item_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          department_id?: string | null
          id?: string
          mentions?: Json
          strategy_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "directive_messages_strategy_item_id_fkey"
            columns: ["strategy_item_id"]
            isOneToOne: false
            referencedRelation: "strategy_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dispo_brand_settings: {
        Row: {
          brand_logos: Json
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_style: string | null
          default_template: string | null
          id: string
          logo_url: string | null
          primary_color: string
          secondary_color: string | null
          tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_logos?: Json
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_style?: string | null
          default_template?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_logos?: Json
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_style?: string | null
          default_template?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dispo_buyers: {
        Row: {
          buy_box_notes: string | null
          company: string | null
          county_metro: string[] | null
          created_at: string
          email: string | null
          email_opt_in: boolean
          financing: string | null
          first_name: string
          ghl_contact_id: string | null
          id: string
          last_name: string
          markets: string[]
          max_price: number | null
          min_baths: number | null
          min_beds: number | null
          min_price: number | null
          min_sqft: number | null
          notes: string | null
          phone: string | null
          proof_of_funds: boolean
          property_types: string[]
          sms_opt_in: boolean
          source: string
          states: string[]
          status: string
          strategies: string[]
          tier: string | null
          updated_at: string
          zips: string[]
        }
        Insert: {
          buy_box_notes?: string | null
          company?: string | null
          county_metro?: string[] | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          financing?: string | null
          first_name?: string
          ghl_contact_id?: string | null
          id?: string
          last_name?: string
          markets?: string[]
          max_price?: number | null
          min_baths?: number | null
          min_beds?: number | null
          min_price?: number | null
          min_sqft?: number | null
          notes?: string | null
          phone?: string | null
          proof_of_funds?: boolean
          property_types?: string[]
          sms_opt_in?: boolean
          source?: string
          states?: string[]
          status?: string
          strategies?: string[]
          tier?: string | null
          updated_at?: string
          zips?: string[]
        }
        Update: {
          buy_box_notes?: string | null
          company?: string | null
          county_metro?: string[] | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          financing?: string | null
          first_name?: string
          ghl_contact_id?: string | null
          id?: string
          last_name?: string
          markets?: string[]
          max_price?: number | null
          min_baths?: number | null
          min_beds?: number | null
          min_price?: number | null
          min_sqft?: number | null
          notes?: string | null
          phone?: string | null
          proof_of_funds?: boolean
          property_types?: string[]
          sms_opt_in?: boolean
          source?: string
          states?: string[]
          status?: string
          strategies?: string[]
          tier?: string | null
          updated_at?: string
          zips?: string[]
        }
        Relationships: []
      }
      dispo_campaign_recipients: {
        Row: {
          buyer_id: string
          campaign_id: string
          error: string | null
          id: string
          responded_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          buyer_id: string
          campaign_id: string
          error?: string | null
          id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          buyer_id?: string
          campaign_id?: string
          error?: string | null
          id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispo_campaign_recipients_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "dispo_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dispo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      dispo_campaigns: {
        Row: {
          audience: string
          body: string
          channel: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          name: string | null
          recipient_count: number
          sent_count: number
          status: string
          subject: string | null
          template_id: string | null
          transaction_id: string | null
        }
        Insert: {
          audience?: string
          body: string
          channel: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          name?: string | null
          recipient_count?: number
          sent_count?: number
          status?: string
          subject?: string | null
          template_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          name?: string | null
          recipient_count?: number
          sent_count?: number
          status?: string
          subject?: string | null
          template_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispo_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dispo_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_campaigns_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_campaigns_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      dispo_checklist_templates: {
        Row: {
          active: boolean
          category: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          category?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          category?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      dispo_deal_assets: {
        Row: {
          asset_type: string
          content: Json
          created_at: string
          id: string
          label: string | null
          template_id: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          asset_type: string
          content?: Json
          created_at?: string
          id?: string
          label?: string | null
          template_id?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          asset_type?: string
          content?: Json
          created_at?: string
          id?: string
          label?: string | null
          template_id?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispo_deal_assets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_deal_assets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      dispo_deal_details: {
        Row: {
          address_private: boolean
          arv: number | null
          baths: number | null
          beds: number | null
          comps: string | null
          created_at: string
          description: string | null
          dispo_stage: string
          email_content: Json | null
          flyer_settings: Json | null
          investment_details: string | null
          investor_highlight: string | null
          landing_settings: Json | null
          marketing_checklist: Json | null
          marketing_copy: Json | null
          photo_url: string | null
          photos: string[] | null
          repair_estimate: number | null
          social_settings: Json | null
          sqft: number | null
          transaction_id: string
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_private?: boolean
          arv?: number | null
          baths?: number | null
          beds?: number | null
          comps?: string | null
          created_at?: string
          description?: string | null
          dispo_stage?: string
          email_content?: Json | null
          flyer_settings?: Json | null
          investment_details?: string | null
          investor_highlight?: string | null
          landing_settings?: Json | null
          marketing_checklist?: Json | null
          marketing_copy?: Json | null
          photo_url?: string | null
          photos?: string[] | null
          repair_estimate?: number | null
          social_settings?: Json | null
          sqft?: number | null
          transaction_id: string
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address_private?: boolean
          arv?: number | null
          baths?: number | null
          beds?: number | null
          comps?: string | null
          created_at?: string
          description?: string | null
          dispo_stage?: string
          email_content?: Json | null
          flyer_settings?: Json | null
          investment_details?: string | null
          investor_highlight?: string | null
          landing_settings?: Json | null
          marketing_checklist?: Json | null
          marketing_copy?: Json | null
          photo_url?: string | null
          photos?: string[] | null
          repair_estimate?: number | null
          social_settings?: Json | null
          sqft?: number | null
          transaction_id?: string
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispo_deal_details_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_deal_details_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      dispo_deal_interests: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          level: string
          notes: string | null
          offer_amount: number | null
          source: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          level?: string
          notes?: string | null
          offer_amount?: number | null
          source?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          level?: string
          notes?: string | null
          offer_amount?: number | null
          source?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispo_deal_interests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "dispo_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_deal_interests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispo_deal_interests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      dispo_managers: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dispo_site_leads: {
        Row: {
          attempts: number
          buy_box: Json | null
          created_at: string
          deal_slug: string | null
          email: string | null
          error: string | null
          first_name: string | null
          id: string
          kind: string
          last_name: string | null
          message: string | null
          offer_price: number | null
          phone: string | null
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          attempts?: number
          buy_box?: Json | null
          created_at?: string
          deal_slug?: string | null
          email?: string | null
          error?: string | null
          first_name?: string | null
          id?: string
          kind: string
          last_name?: string | null
          message?: string | null
          offer_price?: number | null
          phone?: string | null
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          attempts?: number
          buy_box?: Json | null
          created_at?: string
          deal_slug?: string | null
          email?: string | null
          error?: string | null
          first_name?: string | null
          id?: string
          kind?: string
          last_name?: string | null
          message?: string | null
          offer_price?: number | null
          phone?: string | null
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: []
      }
      dispo_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_links: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          author_id: string | null
          author_name: string | null
          business_plan_id: string | null
          content: string | null
          cover_position: number
          cover_url: string | null
          created_at: string
          icon: string | null
          id: string
          parent_id: string | null
          project_id: string | null
          shared_with: Json | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          business_plan_id?: string | null
          content?: string | null
          cover_position?: number
          cover_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          parent_id?: string | null
          project_id?: string | null
          shared_with?: Json | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          business_plan_id?: string | null
          content?: string | null
          cover_position?: number
          cover_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          parent_id?: string | null
          project_id?: string | null
          shared_with?: Json | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ema_candidate_documents: {
        Row: {
          content_sha256: string | null
          created_at: string
          document_type: string
          ema_candidate_id: string
          ema_message_id: string
          extracted_text: string | null
          extracted_text_chars: number
          extraction_method: string | null
          extraction_status: string
          filename: string
          gmail_attachment_id: string
          id: string
          mime_type: string | null
          source_metadata: Json
          total_pages: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content_sha256?: string | null
          created_at?: string
          document_type: string
          ema_candidate_id: string
          ema_message_id: string
          extracted_text?: string | null
          extracted_text_chars?: number
          extraction_method?: string | null
          extraction_status?: string
          filename: string
          gmail_attachment_id: string
          id?: string
          mime_type?: string | null
          source_metadata?: Json
          total_pages?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content_sha256?: string | null
          created_at?: string
          document_type?: string
          ema_candidate_id?: string
          ema_message_id?: string
          extracted_text?: string | null
          extracted_text_chars?: number
          extraction_method?: string | null
          extraction_status?: string
          filename?: string
          gmail_attachment_id?: string
          id?: string
          mime_type?: string | null
          source_metadata?: Json
          total_pages?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ema_candidate_documents_ema_candidate_id_fkey"
            columns: ["ema_candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidate_documents_ema_message_id_fkey"
            columns: ["ema_message_id"]
            isOneToOne: false
            referencedRelation: "ema_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidate_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ema_candidate_sources: {
        Row: {
          created_at: string
          ema_candidate_id: string
          ema_message_id: string
          fact_updates: Json
          id: string
          reconciliation_metadata: Json
          relation_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ema_candidate_id: string
          ema_message_id: string
          fact_updates?: Json
          id?: string
          reconciliation_metadata?: Json
          relation_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          ema_candidate_id?: string
          ema_message_id?: string
          fact_updates?: Json
          id?: string
          reconciliation_metadata?: Json
          relation_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ema_candidate_sources_ema_candidate_id_fkey"
            columns: ["ema_candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidate_sources_ema_message_id_fkey"
            columns: ["ema_message_id"]
            isOneToOne: false
            referencedRelation: "ema_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidate_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ema_candidates: {
        Row: {
          buy_box_fit_checked_at: string | null
          buy_box_fit_details: Json
          buy_box_fit_result: string
          candidate_fingerprint: string
          candidate_index: number
          candidate_type: string | null
          cash_screen_result: string
          cash_screened_at: string | null
          cash_task_id: string | null
          created_at: string
          ema_message_id: string
          evidence: Json
          extracted_facts: Json
          ghl_contact_id: string | null
          ghl_opportunity_id: string | null
          ghl_readiness: string
          id: string
          intake_result: string | null
          is_test: boolean
          last_evaluated_at: string | null
          missing_information: Json
          normalized_address: string | null
          parent_candidate_id: string | null
          portfolio_document_checked_at: string | null
          portfolio_document_inventory: Json
          portfolio_document_status: string
          portfolio_missing_documents: Json
          processing_status: string
          source_type: string | null
          test_run_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          buy_box_fit_checked_at?: string | null
          buy_box_fit_details?: Json
          buy_box_fit_result?: string
          candidate_fingerprint: string
          candidate_index: number
          candidate_type?: string | null
          cash_screen_result?: string
          cash_screened_at?: string | null
          cash_task_id?: string | null
          created_at?: string
          ema_message_id: string
          evidence?: Json
          extracted_facts?: Json
          ghl_contact_id?: string | null
          ghl_opportunity_id?: string | null
          ghl_readiness?: string
          id?: string
          intake_result?: string | null
          is_test?: boolean
          last_evaluated_at?: string | null
          missing_information?: Json
          normalized_address?: string | null
          parent_candidate_id?: string | null
          portfolio_document_checked_at?: string | null
          portfolio_document_inventory?: Json
          portfolio_document_status?: string
          portfolio_missing_documents?: Json
          processing_status?: string
          source_type?: string | null
          test_run_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          buy_box_fit_checked_at?: string | null
          buy_box_fit_details?: Json
          buy_box_fit_result?: string
          candidate_fingerprint?: string
          candidate_index?: number
          candidate_type?: string | null
          cash_screen_result?: string
          cash_screened_at?: string | null
          cash_task_id?: string | null
          created_at?: string
          ema_message_id?: string
          evidence?: Json
          extracted_facts?: Json
          ghl_contact_id?: string | null
          ghl_opportunity_id?: string | null
          ghl_readiness?: string
          id?: string
          intake_result?: string | null
          is_test?: boolean
          last_evaluated_at?: string | null
          missing_information?: Json
          normalized_address?: string | null
          parent_candidate_id?: string | null
          portfolio_document_checked_at?: string | null
          portfolio_document_inventory?: Json
          portfolio_document_status?: string
          portfolio_missing_documents?: Json
          processing_status?: string
          source_type?: string | null
          test_run_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ema_candidates_cash_task_id_fkey"
            columns: ["cash_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidates_ema_message_id_fkey"
            columns: ["ema_message_id"]
            isOneToOne: false
            referencedRelation: "ema_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidates_parent_candidate_id_fkey"
            columns: ["parent_candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_candidates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ema_errors: {
        Row: {
          created_at: string
          details: Json
          ema_candidate_id: string | null
          ema_message_id: string | null
          ema_operation_id: string | null
          error_code: string | null
          error_message: string
          id: string
          is_test: boolean
          step: string
          test_run_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          ema_candidate_id?: string | null
          ema_message_id?: string | null
          ema_operation_id?: string | null
          error_code?: string | null
          error_message: string
          id?: string
          is_test?: boolean
          step: string
          test_run_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          ema_candidate_id?: string | null
          ema_message_id?: string | null
          ema_operation_id?: string | null
          error_code?: string | null
          error_message?: string
          id?: string
          is_test?: boolean
          step?: string
          test_run_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ema_errors_ema_candidate_id_fkey"
            columns: ["ema_candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_errors_ema_message_id_fkey"
            columns: ["ema_message_id"]
            isOneToOne: false
            referencedRelation: "ema_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_errors_ema_operation_id_fkey"
            columns: ["ema_operation_id"]
            isOneToOne: false
            referencedRelation: "ema_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_errors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ema_messages: {
        Row: {
          created_at: string
          gmail_account: string
          gmail_message_id: string
          gmail_thread_id: string
          id: string
          is_test: boolean
          processing_status: string
          raw_metadata: Json
          received_at: string | null
          recipient_addresses: Json
          sender_email: string | null
          sender_name: string | null
          subject: string | null
          supersedes_message_id: string | null
          test_run_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          gmail_account: string
          gmail_message_id: string
          gmail_thread_id: string
          id?: string
          is_test?: boolean
          processing_status?: string
          raw_metadata?: Json
          received_at?: string | null
          recipient_addresses?: Json
          sender_email?: string | null
          sender_name?: string | null
          subject?: string | null
          supersedes_message_id?: string | null
          test_run_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          gmail_account?: string
          gmail_message_id?: string
          gmail_thread_id?: string
          id?: string
          is_test?: boolean
          processing_status?: string
          raw_metadata?: Json
          received_at?: string | null
          recipient_addresses?: Json
          sender_email?: string | null
          sender_name?: string | null
          subject?: string | null
          supersedes_message_id?: string | null
          test_run_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ema_messages_supersedes_message_id_fkey"
            columns: ["supersedes_message_id"]
            isOneToOne: false
            referencedRelation: "ema_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ema_operations: {
        Row: {
          attempt_count: number
          created_at: string
          ema_candidate_id: string | null
          ema_message_id: string | null
          external_id: string | null
          id: string
          idempotency_key: string
          is_test: boolean
          last_error: string | null
          operating_mode: string
          operation_status: string
          operation_type: string
          request_metadata: Json
          result_metadata: Json
          test_run_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          ema_candidate_id?: string | null
          ema_message_id?: string | null
          external_id?: string | null
          id?: string
          idempotency_key: string
          is_test?: boolean
          last_error?: string | null
          operating_mode: string
          operation_status?: string
          operation_type: string
          request_metadata?: Json
          result_metadata?: Json
          test_run_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          ema_candidate_id?: string | null
          ema_message_id?: string | null
          external_id?: string | null
          id?: string
          idempotency_key?: string
          is_test?: boolean
          last_error?: string | null
          operating_mode?: string
          operation_status?: string
          operation_type?: string
          request_metadata?: Json
          result_metadata?: Json
          test_run_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ema_operations_ema_candidate_id_fkey"
            columns: ["ema_candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_operations_ema_message_id_fkey"
            columns: ["ema_message_id"]
            isOneToOne: false
            referencedRelation: "ema_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ema_operations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          gmail_message_id: string | null
          gmail_thread_id: string
          id: string
          linked_by: string | null
          snippet: string | null
          subject: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          gmail_message_id?: string | null
          gmail_thread_id: string
          id?: string
          linked_by?: string | null
          snippet?: string | null
          subject?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string
          id?: string
          linked_by?: string | null
          snippet?: string | null
          subject?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      entity_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      events: {
        Row: {
          actor: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          needs_action: boolean
          read_at: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string | null
          title: string
          type: string
        }
        Insert: {
          actor?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          needs_action?: boolean
          read_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string | null
          title: string
          type: string
        }
        Update: {
          actor?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          needs_action?: boolean
          read_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      evergreen_site_leads: {
        Row: {
          attempts: number
          created_at: string
          email: string | null
          error: string | null
          first_name: string | null
          id: string
          kind: string
          last_name: string | null
          message: string | null
          phone: string | null
          processed: boolean
          processed_at: string | null
          source_page: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          email?: string | null
          error?: string | null
          first_name?: string | null
          id?: string
          kind: string
          last_name?: string | null
          message?: string | null
          phone?: string | null
          processed?: boolean
          processed_at?: string | null
          source_page?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string | null
          error?: string | null
          first_name?: string | null
          id?: string
          kind?: string
          last_name?: string | null
          message?: string | null
          phone?: string | null
          processed?: boolean
          processed_at?: string | null
          source_page?: string | null
        }
        Relationships: []
      }
      flip_analysis_policies: {
        Row: {
          acquisition_closing_cost_pct: number | null
          asset_class: string
          created_at: string
          hold_months: number | null
          id: string
          market: string
          monthly_hoa: number | null
          monthly_insurance: number | null
          monthly_maintenance: number | null
          monthly_other_carry: number | null
          monthly_property_taxes: number | null
          monthly_utilities: number | null
          name: string
          notes: string | null
          sale_cost_pct: number | null
          source_reference: string
          status: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          acquisition_closing_cost_pct?: number | null
          asset_class?: string
          created_at?: string
          hold_months?: number | null
          id?: string
          market: string
          monthly_hoa?: number | null
          monthly_insurance?: number | null
          monthly_maintenance?: number | null
          monthly_other_carry?: number | null
          monthly_property_taxes?: number | null
          monthly_utilities?: number | null
          name: string
          notes?: string | null
          sale_cost_pct?: number | null
          source_reference: string
          status?: string
          updated_at?: string
          version: number
          workspace_id: string
        }
        Update: {
          acquisition_closing_cost_pct?: number | null
          asset_class?: string
          created_at?: string
          hold_months?: number | null
          id?: string
          market?: string
          monthly_hoa?: number | null
          monthly_insurance?: number | null
          monthly_maintenance?: number | null
          monthly_other_carry?: number | null
          monthly_property_taxes?: number | null
          monthly_utilities?: number | null
          name?: string
          notes?: string | null
          sale_cost_pct?: number | null
          source_reference?: string
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flip_analysis_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          id: string
          review_notes: string
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          template_id: string | null
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          id?: string
          review_notes?: string
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          template_id?: string | null
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          id?: string
          review_notes?: string
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          template_id?: string | null
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          description: string
          fields: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ghl_contacts_snapshot: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string | null
          date_added: string | null
          date_updated: string | null
          email: string | null
          id: string
          lead_status: string | null
          location_id: string | null
          name: string | null
          phone: string | null
          snapshot_date: string | null
          tags: Json | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          date_added?: string | null
          date_updated?: string | null
          email?: string | null
          id?: string
          lead_status?: string | null
          location_id?: string | null
          name?: string | null
          phone?: string | null
          snapshot_date?: string | null
          tags?: Json | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          date_added?: string | null
          date_updated?: string | null
          email?: string | null
          id?: string
          lead_status?: string | null
          location_id?: string | null
          name?: string | null
          phone?: string | null
          snapshot_date?: string | null
          tags?: Json | null
        }
        Relationships: []
      }
      ghl_conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          direction: string | null
          id: string
          last_message_date: string | null
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          last_message_date?: string | null
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          last_message_date?: string | null
          type?: string | null
        }
        Relationships: []
      }
      ghl_opportunities: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_at_snapshot: string | null
          id: string
          monetary_value: number | null
          opportunity_id: string | null
          pipeline_id: string | null
          snapshot_date: string | null
          stage_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_at_snapshot?: string | null
          id?: string
          monetary_value?: number | null
          opportunity_id?: string | null
          pipeline_id?: string | null
          snapshot_date?: string | null
          stage_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_at_snapshot?: string | null
          id?: string
          monetary_value?: number | null
          opportunity_id?: string | null
          pipeline_id?: string | null
          snapshot_date?: string | null
          stage_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ghl_stage_events: {
        Row: {
          authenticated: boolean
          candidate_id: string | null
          cash_task_id: string | null
          created_at: string
          decision: string
          delivery_key: string
          duplicate_count: number
          event_timestamp: string | null
          event_type: string | null
          first_received_at: string
          id: string
          last_received_at: string
          location_id: string | null
          opportunity_id: string | null
          payload_sha256: string
          pipeline_id: string | null
          provider_event_id: string | null
          raw_metadata: Json
          raw_size_bytes: number
          result_metadata: Json
          signature_kind: string
          stage_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          authenticated?: boolean
          candidate_id?: string | null
          cash_task_id?: string | null
          created_at?: string
          decision: string
          delivery_key: string
          duplicate_count?: number
          event_timestamp?: string | null
          event_type?: string | null
          first_received_at?: string
          id?: string
          last_received_at?: string
          location_id?: string | null
          opportunity_id?: string | null
          payload_sha256: string
          pipeline_id?: string | null
          provider_event_id?: string | null
          raw_metadata?: Json
          raw_size_bytes?: number
          result_metadata?: Json
          signature_kind?: string
          stage_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          authenticated?: boolean
          candidate_id?: string | null
          cash_task_id?: string | null
          created_at?: string
          decision?: string
          delivery_key?: string
          duplicate_count?: number
          event_timestamp?: string | null
          event_type?: string | null
          first_received_at?: string
          id?: string
          last_received_at?: string
          location_id?: string | null
          opportunity_id?: string | null
          payload_sha256?: string
          pipeline_id?: string | null
          provider_event_id?: string | null
          raw_metadata?: Json
          raw_size_bytes?: number
          result_metadata?: Json
          signature_kind?: string
          stage_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_stage_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_stage_events_cash_task_id_fkey"
            columns: ["cash_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_stage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_access_rules: {
        Row: {
          allow_all_admins: boolean
          allow_all_members: boolean
          allowed_roles: string[]
          allowed_user_ids: string[]
          created_at: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allow_all_admins?: boolean
          allow_all_members?: boolean
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allow_all_admins?: boolean
          allow_all_members?: boolean
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      gmail_tokens: {
        Row: {
          created_at: string
          id: string
          refresh_token: string
          scopes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          refresh_token: string
          scopes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          refresh_token?: string
          scopes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      gmail_workspace_account: {
        Row: {
          connected_at: string
          connected_by: string | null
          email: string
          id: string
          is_default: boolean
          label: string | null
          refresh_token_secret_id: string
          revoked_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          connected_at?: string
          connected_by?: string | null
          email: string
          id?: string
          is_default?: boolean
          label?: string | null
          refresh_token_secret_id: string
          revoked_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          connected_at?: string
          connected_by?: string | null
          email?: string
          id?: string
          is_default?: boolean
          label?: string | null
          refresh_token_secret_id?: string
          revoked_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          alignment_notes: string
          business_plan_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          department_id: string | null
          description: string
          followers: string[]
          id: string
          key_results: Json
          measurable_target: string
          owner_id: string | null
          progress: number
          quarter: string
          status: string
          title: string
          updated_at: string
          workspace_id: string | null
          year: number
        }
        Insert: {
          alignment_notes?: string
          business_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string
          followers?: string[]
          id?: string
          key_results?: Json
          measurable_target?: string
          owner_id?: string | null
          progress?: number
          quarter?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id?: string | null
          year?: number
        }
        Update: {
          alignment_notes?: string
          business_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string
          followers?: string[]
          id?: string
          key_results?: Json
          measurable_target?: string
          owner_id?: string | null
          progress?: number
          quarter?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_vault: {
        Row: {
          ai_cluster: string | null
          ai_summary: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          effort_estimate: string | null
          id: string
          promoted_at: string | null
          promoted_to_id: string | null
          promoted_to_type: string | null
          source: string
          status: string
          time_horizon: string | null
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          ai_cluster?: string | null
          ai_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          effort_estimate?: string | null
          id?: string
          promoted_at?: string | null
          promoted_to_id?: string | null
          promoted_to_type?: string | null
          source?: string
          status?: string
          time_horizon?: string | null
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          ai_cluster?: string | null
          ai_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          effort_estimate?: string | null
          id?: string
          promoted_at?: string | null
          promoted_to_id?: string | null
          promoted_to_type?: string | null
          source?: string
          status?: string
          time_horizon?: string | null
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      issues: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          department_id: string | null
          description: string
          discussion_notes: string
          id: string
          priority: number
          raised_by: string | null
          resolution: string
          resolved_action_id: string | null
          resolved_action_type: string
          root_cause: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          description?: string
          discussion_notes?: string
          id?: string
          priority?: number
          raised_by?: string | null
          resolution?: string
          resolved_action_id?: string | null
          resolved_action_type?: string
          root_cause?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          description?: string
          discussion_notes?: string
          id?: string
          priority?: number
          raised_by?: string | null
          resolution?: string
          resolved_action_id?: string | null
          resolved_action_type?: string
          root_cause?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_stage_colors: {
        Row: {
          board_type: string
          color: string
          created_at: string
          id: string
          stage_key: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          board_type: string
          color: string
          created_at?: string
          id?: string
          stage_key: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          board_type?: string
          color?: string
          created_at?: string
          id?: string
          stage_key?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      kudos: {
        Row: {
          category: string
          created_at: string
          from_user_id: string | null
          id: string
          message: string
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          message?: string
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          message?: string
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_files: {
        Row: {
          created_at: string
          id: string
          kind: string
          lead_id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
          url: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          lead_id: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_meeting_action_items: {
        Row: {
          agenda_item_id: string | null
          assigned_to: string
          converted_to_task_id: string | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          title: string
        }
        Insert: {
          agenda_item_id?: string | null
          assigned_to: string
          converted_to_task_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          title: string
        }
        Update: {
          agenda_item_id?: string | null
          assigned_to?: string
          converted_to_task_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "leadership_meeting_action_items_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leadership_meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "leadership_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_meetings: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          meeting_date: string
          meeting_week: string
          overall_notes: string | null
          rating: number | null
          started_at: string | null
          status: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_date?: string
          meeting_week?: string
          overall_notes?: string | null
          rating?: number | null
          started_at?: string | null
          status?: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_date?: string
          meeting_week?: string
          overall_notes?: string | null
          rating?: number | null
          started_at?: string | null
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leadership_meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          asking_price: number | null
          baths: number | null
          beds: number | null
          buy_box_fit: string
          company_name: string | null
          converted_contact_id: string | null
          converted_deal_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          disqualification_reason: string | null
          email: string | null
          gross_income: number | null
          has_om: boolean
          has_rent_roll: boolean
          has_t12: boolean
          id: string
          lane: string
          listed_cap_rate: number | null
          lot_size: string | null
          name: string
          next_action_at: string | null
          noi: number | null
          notes: string
          owner_id: string | null
          phone: string | null
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_type: string | null
          property_zip: string | null
          source: string | null
          source_contact_id: string | null
          sqft: number | null
          status: string
          temperature: string
          title: string | null
          unit_mix: string | null
          units: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          asking_price?: number | null
          baths?: number | null
          beds?: number | null
          buy_box_fit?: string
          company_name?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          disqualification_reason?: string | null
          email?: string | null
          gross_income?: number | null
          has_om?: boolean
          has_rent_roll?: boolean
          has_t12?: boolean
          id?: string
          lane?: string
          listed_cap_rate?: number | null
          lot_size?: string | null
          name?: string
          next_action_at?: string | null
          noi?: number | null
          notes?: string
          owner_id?: string | null
          phone?: string | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_type?: string | null
          property_zip?: string | null
          source?: string | null
          source_contact_id?: string | null
          sqft?: number | null
          status?: string
          temperature?: string
          title?: string | null
          unit_mix?: string | null
          units?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          asking_price?: number | null
          baths?: number | null
          beds?: number | null
          buy_box_fit?: string
          company_name?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          disqualification_reason?: string | null
          email?: string | null
          gross_income?: number | null
          has_om?: boolean
          has_rent_roll?: boolean
          has_t12?: boolean
          id?: string
          lane?: string
          listed_cap_rate?: number | null
          lot_size?: string | null
          name?: string
          next_action_at?: string | null
          noi?: number | null
          notes?: string
          owner_id?: string | null
          phone?: string | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_type?: string | null
          property_zip?: string | null
          source?: string | null
          source_contact_id?: string | null
          sqft?: number | null
          status?: string
          temperature?: string
          title?: string | null
          unit_mix?: string | null
          units?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      market_research: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          created_by: string | null
          id: string
          market_id: string | null
          market_name: string
          status: string
          strategy: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          market_id?: string | null
          market_name: string
          status?: string
          strategy?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          market_id?: string | null
          market_name?: string
          status?: string
          strategy?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_research_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_research_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_scorecard_categories: {
        Row: {
          ai_scorable: boolean
          guidance: string | null
          key: string
          label: string
          layer: string
          sort_order: number
        }
        Insert: {
          ai_scorable?: boolean
          guidance?: string | null
          key: string
          label: string
          layer: string
          sort_order?: number
        }
        Update: {
          ai_scorable?: boolean
          guidance?: string | null
          key?: string
          label?: string
          layer?: string
          sort_order?: number
        }
        Relationships: []
      }
      market_scorecard_row_history: {
        Row: {
          category: string
          changed_at: string
          conflict_flag: boolean | null
          id: string
          is_core_red: boolean | null
          market_id: string
          note: string | null
          rating: string | null
          source: string | null
          updated_by: string | null
          updated_by_kind: string
        }
        Insert: {
          category: string
          changed_at?: string
          conflict_flag?: boolean | null
          id?: string
          is_core_red?: boolean | null
          market_id: string
          note?: string | null
          rating?: string | null
          source?: string | null
          updated_by?: string | null
          updated_by_kind: string
        }
        Update: {
          category?: string
          changed_at?: string
          conflict_flag?: boolean | null
          id?: string
          is_core_red?: boolean | null
          market_id?: string
          note?: string | null
          rating?: string | null
          source?: string | null
          updated_by?: string | null
          updated_by_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_scorecard_row_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_scorecard_rows: {
        Row: {
          category: string
          conflict_flag: boolean
          conflict_note: string | null
          id: string
          is_core_red: boolean
          market_id: string
          note: string | null
          rating: string | null
          source: string | null
          updated_at: string
          updated_by: string | null
          updated_by_kind: string
        }
        Insert: {
          category: string
          conflict_flag?: boolean
          conflict_note?: string | null
          id?: string
          is_core_red?: boolean
          market_id: string
          note?: string | null
          rating?: string | null
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_kind?: string
        }
        Update: {
          category?: string
          conflict_flag?: boolean
          conflict_note?: string | null
          id?: string
          is_core_red?: boolean
          market_id?: string
          note?: string | null
          rating?: string | null
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_scorecard_rows_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "market_scorecard_categories"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "market_scorecard_rows_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          asset_class: string | null
          created_at: string
          created_by: string | null
          criteria: string | null
          decision: string | null
          decision_next_step: string | null
          decision_updated_by: string | null
          decision_updated_by_kind: string
          decision_why: string | null
          id: string
          last_scored_at: string | null
          links: Json
          location: string | null
          name: string
          notes_html: string | null
          strategy: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          asset_class?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          decision?: string | null
          decision_next_step?: string | null
          decision_updated_by?: string | null
          decision_updated_by_kind?: string
          decision_why?: string | null
          id?: string
          last_scored_at?: string | null
          links?: Json
          location?: string | null
          name: string
          notes_html?: string | null
          strategy?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          asset_class?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          decision?: string | null
          decision_next_step?: string | null
          decision_updated_by?: string | null
          decision_updated_by_kind?: string
          decision_why?: string | null
          id?: string
          last_scored_at?: string | null
          links?: Json
          location?: string | null
          name?: string
          notes_html?: string | null
          strategy?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items: {
        Row: {
          assignee_email: string | null
          assignee_user_id: string | null
          completed: boolean
          converted_task_id: string | null
          created_at: string
          id: string
          meeting_id: string
          sort_order: number
          text: string
        }
        Insert: {
          assignee_email?: string | null
          assignee_user_id?: string | null
          completed?: boolean
          converted_task_id?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          sort_order?: number
          text: string
        }
        Update: {
          assignee_email?: string | null
          assignee_user_id?: string | null
          completed?: boolean
          converted_task_id?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_items: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          discussion_notes: string | null
          id: string
          item_type: string
          meeting_id: string
          reference_id: string | null
          reference_type: string | null
          section: string
          sort_order: number
          status: string
          title: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          discussion_notes?: string | null
          id?: string
          item_type?: string
          meeting_id: string
          reference_id?: string | null
          reference_type?: string | null
          section: string
          sort_order?: number
          status?: string
          title: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          discussion_notes?: string | null
          id?: string
          item_type?: string
          meeting_id?: string
          reference_id?: string | null
          reference_type?: string | null
          section?: string
          sort_order?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "leadership_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          action_items: Json
          ai_insights: string | null
          attendees: Json
          created_at: string
          duration_seconds: number | null
          fathom_meeting_id: string | null
          fathom_url: string | null
          has_external_participants: boolean
          host_email: string | null
          id: string
          key_decisions: string[]
          raw_payload: Json | null
          recording_id: string | null
          recording_url: string | null
          sentiment: string | null
          started_at: string | null
          summary: string | null
          synced_at: string | null
          title: string
          transcript_text: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          action_items?: Json
          ai_insights?: string | null
          attendees?: Json
          created_at?: string
          duration_seconds?: number | null
          fathom_meeting_id?: string | null
          fathom_url?: string | null
          has_external_participants?: boolean
          host_email?: string | null
          id?: string
          key_decisions?: string[]
          raw_payload?: Json | null
          recording_id?: string | null
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          summary?: string | null
          synced_at?: string | null
          title?: string
          transcript_text?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          action_items?: Json
          ai_insights?: string | null
          attendees?: Json
          created_at?: string
          duration_seconds?: number | null
          fathom_meeting_id?: string | null
          fathom_url?: string | null
          has_external_participants?: boolean
          host_email?: string | null
          id?: string
          key_decisions?: string[]
          raw_payload?: Json | null
          recording_id?: string | null
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          summary?: string | null
          synced_at?: string | null
          title?: string
          transcript_text?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          agent_id: string
          content: string | null
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      note_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          converted_doc_id: string | null
          cover_position: number | null
          cover_url: string | null
          created_at: string
          folder: string | null
          full_width: boolean
          icon: string | null
          id: string
          is_public: boolean
          notebook_id: string | null
          pinned: boolean
          share_token: string | null
          shared_with: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          converted_doc_id?: string | null
          cover_position?: number | null
          cover_url?: string | null
          created_at?: string
          folder?: string | null
          full_width?: boolean
          icon?: string | null
          id?: string
          is_public?: boolean
          notebook_id?: string | null
          pinned?: boolean
          share_token?: string | null
          shared_with?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          converted_doc_id?: string | null
          cover_position?: number | null
          cover_url?: string | null
          created_at?: string
          folder?: string | null
          full_width?: boolean
          icon?: string | null
          id?: string
          is_public?: boolean
          notebook_id?: string | null
          pinned?: boolean
          share_token?: string | null
          shared_with?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "note_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          audience: string
          created_at: string
          description: string | null
          id: string
          link: string | null
          link_label: string | null
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          link_label?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          link_label?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      orbit_call_events: {
        Row: {
          contact_id: string | null
          created_at: string
          dedupe_key: string
          disposition: string | null
          duration_seconds: number | null
          ghl_user_id: string
          id: string
          occurred_at: string
          raw: Json | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          dedupe_key: string
          disposition?: string | null
          duration_seconds?: number | null
          ghl_user_id: string
          id?: string
          occurred_at?: string
          raw?: Json | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          dedupe_key?: string
          disposition?: string | null
          duration_seconds?: number | null
          ghl_user_id?: string
          id?: string
          occurred_at?: string
          raw?: Json | null
        }
        Relationships: []
      }
      orbit_disposition_map: {
        Row: {
          category: string
          disposition: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category: string
          disposition: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          disposition?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orbit_members: {
        Row: {
          created_at: string
          department_id: string
          graduated_at: string | null
          id: string
          joined_at: string
          notes: string | null
          removal_reason: string | null
          removed_at: string | null
          status: string
          track: string
          track_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          graduated_at?: string | null
          id?: string
          joined_at?: string
          notes?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          status?: string
          track: string
          track_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          graduated_at?: string | null
          id?: string
          joined_at?: string
          notes?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          status?: string
          track?: string
          track_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orbit_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      orbit_performance_snapshots: {
        Row: {
          appointments_set: number | null
          calls_made: number | null
          conversations: number | null
          created_at: string
          deals_closed: number | null
          id: string
          member_id: string
          notes: string | null
          snapshot_date: string
          source: string
        }
        Insert: {
          appointments_set?: number | null
          calls_made?: number | null
          conversations?: number | null
          created_at?: string
          deals_closed?: number | null
          id?: string
          member_id: string
          notes?: string | null
          snapshot_date: string
          source?: string
        }
        Update: {
          appointments_set?: number | null
          calls_made?: number | null
          conversations?: number | null
          created_at?: string
          deals_closed?: number | null
          id?: string
          member_id?: string
          notes?: string | null
          snapshot_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "orbit_performance_snapshots_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "orbit_members"
            referencedColumns: ["id"]
          },
        ]
      }
      orbit_setup_checklist: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          item_key: string
          label: string
          member_id: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          item_key: string
          label: string
          member_id: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          item_key?: string
          label?: string
          member_id?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "orbit_setup_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "orbit_members"
            referencedColumns: ["id"]
          },
        ]
      }
      orbit_strikes: {
        Row: {
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          issued_by_name: string | null
          member_id: string
          notes: string | null
          reason: string
          strike_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          issued_by_name?: string | null
          member_id: string
          notes?: string | null
          reason?: string
          strike_number: number
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          issued_by_name?: string | null
          member_id?: string
          notes?: string | null
          reason?: string
          strike_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "orbit_strikes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "orbit_members"
            referencedColumns: ["id"]
          },
        ]
      }
      orbit_track_content: {
        Row: {
          created_at: string
          daily_flow: Json | null
          full_name: string | null
          getting_started: Json | null
          id: string
          kpis: Json | null
          success_criteria: Json | null
          tagline: string | null
          track: string
          updated_at: string
          updated_by: string | null
          what_it_is: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          daily_flow?: Json | null
          full_name?: string | null
          getting_started?: Json | null
          id?: string
          kpis?: Json | null
          success_criteria?: Json | null
          tagline?: string | null
          track: string
          updated_at?: string
          updated_by?: string | null
          what_it_is?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          daily_flow?: Json | null
          full_name?: string | null
          getting_started?: Json | null
          id?: string
          kpis?: Json | null
          success_criteria?: Json | null
          tagline?: string | null
          track?: string
          updated_at?: string
          updated_by?: string | null
          what_it_is?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      page_grants: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          page_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          page_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          page_key?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_todos: {
        Row: {
          created_at: string
          id: string
          is_complete: boolean
          mentions: Json | null
          position: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_complete?: boolean
          mentions?: Json | null
          position?: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_complete?: boolean
          mentions?: Json | null
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          probability_default: number
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          probability_default?: number
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          probability_default?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          options: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_replies: {
        Row: {
          audio_url: string | null
          author_name: string | null
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          gif_url: string | null
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          audio_url?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          entity_id: string
          entity_type: string
          gif_url?: string | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          audio_url?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          gif_url?: string | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: string
          created_at: string
          gif_url: string | null
          id: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          gif_url?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          gif_url?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      process_annotations: {
        Row: {
          annotation_type: string
          bucket_id: string
          content: string | null
          created_at: string | null
          id: string
          status: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          annotation_type?: string
          bucket_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          annotation_type?: string
          bucket_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_annotations_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_annotations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_buckets: {
        Row: {
          bucket_order: number
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          node_type: string | null
          notes: string | null
          owner_id: string | null
          parent_id: string | null
          position_x: number | null
          position_y: number | null
          slug: string
          step_group: string | null
          vertical_id: string | null
          workspace_id: string
        }
        Insert: {
          bucket_order: number
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          node_type?: string | null
          notes?: string | null
          owner_id?: string | null
          parent_id?: string | null
          position_x?: number | null
          position_y?: number | null
          slug: string
          step_group?: string | null
          vertical_id?: string | null
          workspace_id: string
        }
        Update: {
          bucket_order?: number
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          node_type?: string | null
          notes?: string | null
          owner_id?: string | null
          parent_id?: string | null
          position_x?: number | null
          position_y?: number | null
          slug?: string
          step_group?: string | null
          vertical_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_buckets_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_buckets_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "process_verticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_buckets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_edges: {
        Row: {
          created_at: string | null
          edge_type: string | null
          id: string
          label: string | null
          source_id: string
          target_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          edge_type?: string | null
          id?: string
          label?: string | null
          source_id: string
          target_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          edge_type?: string | null
          id?: string
          label?: string | null
          source_id?: string
          target_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_edges_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_edges_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_edges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_improvements: {
        Row: {
          bucket_id: string | null
          converted_to_project_id: string | null
          converted_to_task_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          status: string
          step_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bucket_id?: string | null
          converted_to_project_id?: string | null
          converted_to_task_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          status?: string
          step_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bucket_id?: string | null
          converted_to_project_id?: string | null
          converted_to_task_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          status?: string
          step_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_improvements_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_improvements_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_improvements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          bucket_id: string
          created_at: string
          description: string | null
          id: string
          is_complete: boolean
          step_order: number
          title: string
          workspace_id: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_complete?: boolean
          step_order?: number
          title: string
          workspace_id: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_complete?: boolean
          step_order?: number
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "process_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_verticals: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          shared_with: Json
          sort_order: number
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          shared_with?: Json
          sort_order?: number
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          shared_with?: Json
          sort_order?: number
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_verticals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability_status: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          created_at: string
          department_id: string | null
          email: string | null
          email_signature_url: string | null
          full_name: string | null
          ghl_synced_at: string | null
          ghl_user_id: string | null
          id: string
          is_leader: boolean
          is_orbit_only: boolean
          must_set_credential: boolean
          onboarding_completed_at: string | null
          onboarding_progress: Json
          onboarding_skipped: boolean
          phone: string | null
          reports_to: string | null
          role_key: string | null
          skills: string[] | null
          start_date: string | null
          time_clock_enabled: boolean
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          availability_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          email_signature_url?: string | null
          full_name?: string | null
          ghl_synced_at?: string | null
          ghl_user_id?: string | null
          id?: string
          is_leader?: boolean
          is_orbit_only?: boolean
          must_set_credential?: boolean
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
          onboarding_skipped?: boolean
          phone?: string | null
          reports_to?: string | null
          role_key?: string | null
          skills?: string[] | null
          start_date?: string | null
          time_clock_enabled?: boolean
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          availability_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          email_signature_url?: string | null
          full_name?: string | null
          ghl_synced_at?: string | null
          ghl_user_id?: string | null
          id?: string
          is_leader?: boolean
          is_orbit_only?: boolean
          must_set_credential?: boolean
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
          onboarding_skipped?: boolean
          phone?: string | null
          reports_to?: string | null
          role_key?: string | null
          skills?: string[] | null
          start_date?: string | null
          time_clock_enabled?: boolean
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          proposed_tasks: Json | null
          role: string
          tasks_created: boolean
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          project_id: string
          proposed_tasks?: Json | null
          role: string
          tasks_created?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          proposed_tasks?: Json | null
          role?: string
          tasks_created?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          project_id: string
          public_url: string
          storage_path: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          project_id: string
          public_url: string
          storage_path: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          project_id?: string
          public_url?: string
          storage_path?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_views: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          project_id: string
          type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          project_id: string
          type: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          project_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          assignees: string[]
          cover_url: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string
          due_date: string | null
          followers: string[]
          goal_id: string | null
          id: string
          notes_content: string
          owner_id: string | null
          priority: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          assignees?: string[]
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          due_date?: string | null
          followers?: string[]
          goal_id?: string | null
          id?: string
          notes_content?: string
          owner_id?: string | null
          priority?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          assignees?: string[]
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          due_date?: string | null
          followers?: string[]
          goal_id?: string | null
          id?: string
          notes_content?: string
          owner_id?: string | null
          priority?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      property_enrichment_snapshots: {
        Row: {
          candidate_id: string
          created_at: string
          credits_used: number
          facts: Json
          fetched_at: string
          ghl_opportunity_id: string | null
          id: string
          normalized_address: string
          provenance: Json
          provider: string
          provider_property_id: string
          workspace_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          credits_used?: number
          facts?: Json
          fetched_at: string
          ghl_opportunity_id?: string | null
          id?: string
          normalized_address: string
          provenance?: Json
          provider: string
          provider_property_id: string
          workspace_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          credits_used?: number
          facts?: Json
          fetched_at?: string
          ghl_opportunity_id?: string | null
          id?: string
          normalized_address?: string
          provenance?: Json
          provider?: string
          provider_property_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_enrichment_snapshots_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ema_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_enrichment_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rehab_cost_book_items: {
        Row: {
          active: boolean
          category: string
          cost_book_id: string
          created_at: string
          id: string
          notes: string | null
          scope_level: string
          source_reference: string
          unit: string
          unit_cost_base: number
          unit_cost_high: number
          unit_cost_low: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          cost_book_id: string
          created_at?: string
          id?: string
          notes?: string | null
          scope_level: string
          source_reference: string
          unit: string
          unit_cost_base: number
          unit_cost_high: number
          unit_cost_low: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          cost_book_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          scope_level?: string
          source_reference?: string
          unit?: string
          unit_cost_base?: number
          unit_cost_high?: number
          unit_cost_low?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehab_cost_book_items_cost_book_id_fkey"
            columns: ["cost_book_id"]
            isOneToOne: false
            referencedRelation: "rehab_cost_books"
            referencedColumns: ["id"]
          },
        ]
      }
      rehab_cost_books: {
        Row: {
          created_at: string
          default_contingency_pct: number
          id: string
          market: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_contingency_pct: number
          id?: string
          market: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_contingency_pct?: number
          id?: string
          market?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehab_cost_books_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      repos: {
        Row: {
          active: boolean
          created_at: string
          default_branch: string
          description: string | null
          github_repo: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_branch?: string
          description?: string | null
          github_repo: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_branch?: string
          description?: string | null
          github_repo?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      scorecard_entries: {
        Row: {
          actual_value: number | null
          created_at: string | null
          entered_at: string | null
          entered_by: string | null
          id: string
          metric_id: string
          note: string | null
          week_start_date: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          entered_at?: string | null
          entered_by?: string | null
          id?: string
          metric_id: string
          note?: string | null
          week_start_date: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          entered_at?: string | null
          entered_by?: string | null
          id?: string
          metric_id?: string
          note?: string | null
          week_start_date?: string
        }
        Relationships: []
      }
      scorecard_metrics: {
        Row: {
          created_at: string | null
          data_source: string | null
          department_id: string | null
          description: string | null
          ghl_field_key: string | null
          group_label: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string | null
          per_person_target: number | null
          sort_order: number | null
          unit: string
          updated_at: string | null
          weekly_target: number | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_source?: string | null
          department_id?: string | null
          description?: string | null
          ghl_field_key?: string | null
          group_label?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          per_person_target?: number | null
          sort_order?: number | null
          unit?: string
          updated_at?: string | null
          weekly_target?: number | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_source?: string | null
          department_id?: string | null
          description?: string | null
          ghl_field_key?: string | null
          group_label?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          per_person_target?: number | null
          sort_order?: number | null
          unit?: string
          updated_at?: string | null
          weekly_target?: number | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      site_branding: {
        Row: {
          colors: Json
          font_body: string
          font_display: string
          id: number
          logo_image_url: string | null
          logo_text: string | null
          logo_type: string
          updated_at: string
        }
        Insert: {
          colors: Json
          font_body?: string
          font_display?: string
          id?: number
          logo_image_url?: string | null
          logo_text?: string | null
          logo_type?: string
          updated_at?: string
        }
        Update: {
          colors?: Json
          font_body?: string
          font_display?: string
          id?: number
          logo_image_url?: string | null
          logo_text?: string | null
          logo_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content: Json
          id: number
          updated_at: string
        }
        Insert: {
          content?: Json
          id?: number
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      strategy_items: {
        Row: {
          assigned_departments: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          title: string
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_departments?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_departments?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_responses: {
        Row: {
          analysis: string | null
          created_at: string
          department_id: string | null
          expected_impact: string | null
          ground_truth: string | null
          id: string
          recommendation: string | null
          responder_id: string | null
          strategy_item_id: string
          type: string
        }
        Insert: {
          analysis?: string | null
          created_at?: string
          department_id?: string | null
          expected_impact?: string | null
          ground_truth?: string | null
          id?: string
          recommendation?: string | null
          responder_id?: string | null
          strategy_item_id: string
          type?: string
        }
        Update: {
          analysis?: string | null
          created_at?: string
          department_id?: string | null
          expected_impact?: string | null
          ground_truth?: string | null
          id?: string
          recommendation?: string | null
          responder_id?: string | null
          strategy_item_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_responses_strategy_item_id_fkey"
            columns: ["strategy_item_id"]
            isOneToOne: false
            referencedRelation: "strategy_items"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_translations: {
        Row: {
          actions: string[] | null
          created_at: string
          department_id: string
          id: string
          immediate_changes: string | null
          meaning: string | null
          priorities: string[] | null
          strategy_item_id: string
        }
        Insert: {
          actions?: string[] | null
          created_at?: string
          department_id: string
          id?: string
          immediate_changes?: string | null
          meaning?: string | null
          priorities?: string[] | null
          strategy_item_id: string
        }
        Update: {
          actions?: string[] | null
          created_at?: string
          department_id?: string
          id?: string
          immediate_changes?: string | null
          meaning?: string | null
          priorities?: string[] | null
          strategy_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_translations_strategy_item_id_fkey"
            columns: ["strategy_item_id"]
            isOneToOne: false
            referencedRelation: "strategy_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sync_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_channels: {
        Row: {
          created_at: string
          created_by: string | null
          for_role: string | null
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          for_role?: string | null
          id?: string
          name?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          for_role?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_tags: {
        Row: {
          color: string
          created_at: string
          emoji: string
          id: string
          is_system: boolean
          key: string
          label: string
          sort_order: number
          tracks_open_state: boolean
        }
        Insert: {
          color?: string
          created_at?: string
          emoji: string
          id?: string
          is_system?: boolean
          key: string
          label: string
          sort_order?: number
          tracks_open_state?: boolean
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          sort_order?: number
          tracks_open_state?: boolean
        }
        Relationships: []
      }
      sync_thread_messages: {
        Row: {
          attachments: Json | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          mentions: Json | null
          thread_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          mentions?: Json | null
          thread_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          mentions?: Json | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "sync_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_threads: {
        Row: {
          author_id: string | null
          body: string
          channel_id: string
          converted_project_id: string | null
          created_at: string
          id: string
          last_activity_at: string
          linked_items: Json
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tag: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          channel_id: string
          converted_project_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          linked_items?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tag?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel_id?: string
          converted_project_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          linked_items?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tag?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sync_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_threads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          assigned_to: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          followers: string[]
          goal_id: string | null
          id: string
          is_recurring: boolean
          notes_content: string
          priority: string
          project_id: string | null
          recurrence_rule: Json | null
          recurring_parent_id: string | null
          status: string
          subtasks: Json
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          assigned_to?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          followers?: string[]
          goal_id?: string | null
          id?: string
          is_recurring?: boolean
          notes_content?: string
          priority?: string
          project_id?: string | null
          recurrence_rule?: Json | null
          recurring_parent_id?: string | null
          status?: string
          subtasks?: Json
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          assigned_to?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          followers?: string[]
          goal_id?: string | null
          id?: string
          is_recurring?: boolean
          notes_content?: string
          priority?: string
          project_id?: string | null
          recurrence_rule?: Json | null
          recurring_parent_id?: string | null
          status?: string
          subtasks?: Json
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_hub_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_hub_resources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          file_name: string | null
          file_size: number | null
          icon: string | null
          id: string
          kind: string
          mime_type: string | null
          published: boolean
          section_id: string | null
          sort_order: number
          storage_path: string | null
          title: string
          tracks: string[]
          updated_at: string
          url: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          file_name?: string | null
          file_size?: number | null
          icon?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          published?: boolean
          section_id?: string | null
          sort_order?: number
          storage_path?: string | null
          title: string
          tracks?: string[]
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          file_name?: string | null
          file_size?: number | null
          icon?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          published?: boolean
          section_id?: string | null
          sort_order?: number
          storage_path?: string | null
          title?: string
          tracks?: string[]
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_hub_resources_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_hub_resources_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "team_hub_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      team_hub_sections: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          published: boolean
          role_key: string | null
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          published?: boolean
          role_key?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          published?: boolean
          role_key?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_hub_sections_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      team_roles: {
        Row: {
          department_id: string | null
          has_tracks: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          department_id?: string | null
          has_tracks?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          department_id?: string | null
          has_tracks?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_tracks: {
        Row: {
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      training_modules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          role_ids: string[] | null
          sort_order: number | null
          steps: Json
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          role_ids?: string[] | null
          sort_order?: number | null
          steps?: Json
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          role_ids?: string[] | null
          sort_order?: number | null
          steps?: Json
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaction_checklist_items: {
        Row: {
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          is_complete: boolean
          label: string
          sort_order: number
          transaction_id: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_complete?: boolean
          label: string
          sort_order?: number
          transaction_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_complete?: boolean
          label?: string
          sort_order?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_checklist_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_checklist_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_documents: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          doc_type: string
          extracted_fields: Json | null
          extraction_status: string
          file_url: string
          id: string
          transaction_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          doc_type?: string
          extracted_fields?: Json | null
          extraction_status?: string
          file_url: string
          id?: string
          transaction_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          doc_type?: string
          extracted_fields?: Json | null
          extraction_status?: string
          file_url?: string
          id?: string
          transaction_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "public_dispo_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      underwriting_runs: {
        Row: {
          actual_days_to_close: number | null
          actual_insurance: number | null
          actual_rents: number | null
          actual_repair_cost: number | null
          actual_sale_price: number | null
          asset_class: string | null
          buy_box_result: Json | null
          created_at: string
          deal_id: string | null
          external_record_id: string | null
          external_url: string | null
          ghl_opportunity_id: string | null
          headline_metrics: Json | null
          id: string
          limiting_factor: string | null
          packet_url: string | null
          property_address: string | null
          run_by: string | null
          source_channel: string | null
          sourced_by: string | null
          tier: string
          tool: string
          updated_at: string
          verdict: string | null
          workspace_id: string | null
        }
        Insert: {
          actual_days_to_close?: number | null
          actual_insurance?: number | null
          actual_rents?: number | null
          actual_repair_cost?: number | null
          actual_sale_price?: number | null
          asset_class?: string | null
          buy_box_result?: Json | null
          created_at?: string
          deal_id?: string | null
          external_record_id?: string | null
          external_url?: string | null
          ghl_opportunity_id?: string | null
          headline_metrics?: Json | null
          id?: string
          limiting_factor?: string | null
          packet_url?: string | null
          property_address?: string | null
          run_by?: string | null
          source_channel?: string | null
          sourced_by?: string | null
          tier?: string
          tool: string
          updated_at?: string
          verdict?: string | null
          workspace_id?: string | null
        }
        Update: {
          actual_days_to_close?: number | null
          actual_insurance?: number | null
          actual_rents?: number | null
          actual_repair_cost?: number | null
          actual_sale_price?: number | null
          asset_class?: string | null
          buy_box_result?: Json | null
          created_at?: string
          deal_id?: string | null
          external_record_id?: string | null
          external_url?: string | null
          ghl_opportunity_id?: string | null
          headline_metrics?: Json | null
          id?: string
          limiting_factor?: string | null
          packet_url?: string | null
          property_address?: string | null
          run_by?: string | null
          source_channel?: string | null
          sourced_by?: string | null
          tier?: string
          tool?: string
          updated_at?: string
          verdict?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      upward_proposals: {
        Row: {
          ceo_response: string | null
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          reasoning: string | null
          recommendation: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          ceo_response?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          reasoning?: string | null
          recommendation?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          ceo_response?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          reasoning?: string | null
          recommendation?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          custom_icon: string | null
          id: string
          label: string
          sort_order: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_icon?: string | null
          id?: string
          label: string
          sort_order?: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_icon?: string | null
          id?: string
          label?: string
          sort_order?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          is_primary: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          is_primary?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vision: {
        Row: {
          content: Json
          id: string
          section: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          section: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          section?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      whiteboards: {
        Row: {
          business_plan_id: string | null
          cover_color: string
          created_at: string
          created_by: string | null
          description: string
          document: Json | null
          id: string
          pinned_project_ids: string[]
          title: string
          updated_at: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          business_plan_id?: string | null
          cover_color?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document?: Json | null
          id?: string
          pinned_project_ids?: string[]
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          business_plan_id?: string | null
          cover_color?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document?: Json | null
          id?: string
          pinned_project_ids?: string[]
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whiteboards_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_addons: {
        Row: {
          addon_id: string
          enabled_at: string
          enabled_by: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          addon_id: string
          enabled_at?: string
          enabled_by?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          addon_id?: string
          enabled_at?: string
          enabled_by?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_addons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          created_at: string
          gemini_model: string
          openai_model: string
          realtime_provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          gemini_model?: string
          openai_model?: string
          realtime_provider?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          gemini_model?: string
          openai_model?: string
          realtime_provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          accent_color: string | null
          albus_avatar_url: string | null
          app_style: string
          ceo_page_name: string
          created_at: string
          dept_label: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          albus_avatar_url?: string | null
          app_style?: string
          ceo_page_name?: string
          created_at?: string
          dept_label?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          albus_avatar_url?: string | null
          app_style?: string
          ceo_page_name?: string
          created_at?: string
          dept_label?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      book_intercompany_check: {
        Row: {
          fiscal_year: number | null
          intercompany_group: string | null
          net: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      book_partner_capital: {
        Row: {
          capital_balance: number | null
          entity_id: string | null
          fiscal_year: number | null
          partner_id: string | null
          partner_name: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_journal_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "book_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      book_trial_balance: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_type: string | null
          balance: number | null
          code: string | null
          entity_id: string | null
          fiscal_year: number | null
          total_credit: number | null
          total_debit: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_journal_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "book_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      public_dispo_listings: {
        Row: {
          address_private: boolean | null
          arv: number | null
          asking_price: number | null
          baths: number | null
          beds: number | null
          created_at: string | null
          description: string | null
          dispo_stage: string | null
          id: string | null
          investment_details: string | null
          investor_highlight: string | null
          photo_url: string | null
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_type: string | null
          property_zip: string | null
          sqft: number | null
          year_built: number | null
        }
        Relationships: []
      }
      public_listings: {
        Row: {
          address_private: boolean | null
          baths: number | null
          beds: number | null
          best_exit: string | null
          comps: string | null
          description_en: string | null
          description_es: string | null
          financing_details: Json | null
          financing_type: string | null
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          manager_photo_url: string | null
          manager_title: string | null
          marketing_title: string | null
          photos: string[] | null
          price: number | null
          property_city: string | null
          property_county_metro: string | null
          property_state: string | null
          property_type: string | null
          public_status: string | null
          published_at: string | null
          slug: string | null
          sqft: number | null
          street_address: string | null
          year_built: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_deferred_tasks: { Args: never; Returns: undefined }
      agent_gateway_consume_rate_limit: {
        Args: {
          _action: string
          _credential_id: string
          _max_requests: number
          _window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      agent_task_claim_next: {
        Args: {
          p_agent_slug: string
          p_lease_seconds?: number
          p_workspace_id: string
        }
        Returns: {
          context: Json
          description: string
          leased_until: string
          priority: string
          task_id: string
          task_type: string
          title: string
        }[]
      }
      agent_task_claimable_statuses: { Args: never; Returns: string[] }
      agent_task_extend_lease: {
        Args: {
          p_agent_slug: string
          p_lease_seconds?: number
          p_task_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      agent_task_submit_result: {
        Args: {
          p_agent_slug: string
          p_error?: string
          p_result: string
          p_status?: string
          p_task_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      api_token_touch: { Args: { _token_id: string }; Returns: undefined }
      block_cash_sfr_needs_info_work_item: {
        Args: { _work_item_id: string; _workspace_id: string }
        Returns: boolean
      }
      block_stale_cash_sfr_work_item: {
        Args: {
          _live_snapshot: Json
          _reason: string
          _work_item_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      book_apply_rules: {
        Args: { _dry_run?: boolean; _entity_id?: string; _limit?: number }
        Returns: {
          action: string
          detail: string
          rule_id: string
          txn_id: string
        }[]
      }
      book_match_rule: { Args: { _txn_id: string }; Returns: string }
      book_post_intercompany: {
        Args: {
          _benefiting_entity: string
          _memo?: string
          _their_account_id: string
          _txn_id: string
        }
        Returns: string
      }
      book_post_internal_transfers: {
        Args: { _dry_run?: boolean }
        Returns: {
          action: string
          amount: number
          detail: string
          sibling_id: string
          txn_id: string
        }[]
      }
      book_post_transaction: {
        Args: {
          _memo?: string
          _source?: string
          _splits: Json
          _txn_id: string
        }
        Returns: string
      }
      book_resolve_splits: {
        Args: { _gross: number; _rule_id: string }
        Returns: Json
      }
      book_rule_escape: { Args: { _p: string }; Returns: string }
      book_rule_preview: {
        Args: { _limit?: number; _rule_id: string }
        Returns: {
          amount: number
          description: string
          txn_date: string
          txn_id: string
        }[]
      }
      book_transfer_candidates: {
        Args: never
        Returns: {
          amount: number
          bank_account_id: string
          cp_bank_account_id: string
          cp_entity_id: string
          entity_id: string
          txn_date: string
          txn_id: string
        }[]
      }
      book_unpost_transaction: { Args: { _txn_id: string }; Returns: number }
      can_access_ai_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_ai_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_team_hub: { Args: never; Returns: boolean }
      can_use_gmail: { Args: { _user_id: string }; Returns: boolean }
      claim_cash_sfr_activation_signal: {
        Args: {
          _activation_signal_id: string
          _lease_seconds?: number
          _lease_token: string
          _live_snapshot: Json
          _workspace_id: string
        }
        Returns: {
          activation_count: number
          agent_task_id: string
          candidate_id: string
          completed_phases: string[]
          ghl_opportunity_id: string
          resumed: boolean
          task_description: string
          task_title: string
          work_item_id: string
          work_kind: string
        }[]
      }
      claim_next_cash_sfr_work_item: {
        Args: { _workspace_id: string }
        Returns: {
          activation_count: number
          agent_task_id: string
          candidate_id: string
          completed_phases: string[]
          ghl_opportunity_id: string
          resumed: boolean
          task_description: string
          task_title: string
          work_item_id: string
          work_kind: string
        }[]
      }
      complete_cash_sfr_acquisition_review: {
        Args: {
          _progress: Json
          _task_id: string
          _work_item_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      content_capture_list_task_events: {
        Args: {
          p_agent_slug: string
          p_limit?: number
          p_since?: string
          p_workspace_id: string
        }
        Returns: {
          completed_at: string
          headline: string
          source_ref: string
          summary: string
          task_type: string
        }[]
      }
      create_cash_sfr_activation_signal: {
        Args: {
          _activated_at?: string
          _candidate_id: string
          _event_id: string
          _ghl_opportunity_id: string
          _pipeline_id: string
          _stage_id: string
          _workspace_id: string
        }
        Returns: {
          activation_count: number
          activation_signal_id: string
          reused_signal: boolean
        }[]
      }
      delete_project_cascade: { Args: { p_id: string }; Returns: undefined }
      dispo_match_buyers_for_transaction: {
        Args: { transaction_uuid: string }
        Returns: {
          buyer_id: string
          reasons: string[]
          score: number
        }[]
      }
      get_user_workspace_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ai_project_collaborator: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_business_day: { Args: { d: string }; Returns: boolean }
      is_leader: { Args: { _user_id: string }; Returns: boolean }
      is_primary_admin: { Args: { _user_id: string }; Returns: boolean }
      is_sync_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_hub_only: { Args: { _user_id: string }; Returns: boolean }
      lease_active_cash_sfr_work_item: {
        Args: {
          _lease_seconds?: number
          _lease_token: string
          _live_snapshot: Json
          _work_item_id: string
          _workspace_id: string
        }
        Returns: {
          activation_count: number
          agent_task_id: string
          candidate_id: string
          completed_phases: string[]
          ghl_opportunity_id: string
          resumed: boolean
          task_description: string
          task_title: string
          work_item_id: string
          work_kind: string
        }[]
      }
      match_buyers_for_deal: {
        Args: { p_min_score?: number; p_transaction_id: string }
        Returns: {
          buyer_id: string
          company: string
          email: string
          first_name: string
          last_name: string
          markets: string[]
          max_price: number
          phone: string
          reasons: string[]
          score: number
          states: string[]
          tier: string
        }[]
      }
      match_memories: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          agent_id: string
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      next_business_day: { Args: { d: string }; Returns: string }
      normalize_state: { Args: { raw: string }; Returns: string }
      recalc_scorecard_targets: { Args: never; Returns: undefined }
      reconcile_cash_stage_trigger: {
        Args: {
          _activated_at?: string
          _candidate_id: string
          _event_id: string
          _ghl_opportunity_id: string
          _pipeline_id: string
          _stage_id: string
          _work_kind: string
          _workspace_id: string
        }
        Returns: {
          activation_count: number
          agent_task_id: string
          legacy_reconciled: boolean
          reopened: boolean
          reused_task: boolean
          reused_work_item: boolean
          work_item_id: string
        }[]
      }
      reconcile_cash_stage_trigger_v2: {
        Args: {
          _activated_at?: string
          _candidate_id: string
          _event_id: string
          _ghl_opportunity_id: string
          _opportunity_label: string
          _pipeline_id: string
          _stage_id: string
          _work_kind: string
          _workspace_id: string
        }
        Returns: {
          activation_count: number
          agent_task_id: string
          legacy_reconciled: boolean
          reopened: boolean
          reused_task: boolean
          reused_work_item: boolean
          work_item_id: string
        }[]
      }
      run_deadline_checks: { Args: never; Returns: number }
      run_monthly_market_rescore: { Args: never; Returns: number }
      scorecard_metric_track: {
        Args: { p_ghl_field_key: string }
        Returns: string
      }
      stale_cash_sfr_activation_signal: {
        Args: {
          _activation_signal_id: string
          _live_snapshot: Json
          _reason: string
          _workspace_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "team_hub"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "team_hub"],
    },
  },
} as const
