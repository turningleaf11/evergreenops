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
  public: {
    Tables: {
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
          is_active: boolean
          name: string
          price_tier: string
          slug: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_tier?: string
          slug: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_tier?: string
          slug?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      announcement_acknowledgments: {
        Row: {
          acknowledged_at: string
          announcement_id: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          announcement_id: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          announcement_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_acknowledgments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
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
      ceo_briefing_config: {
        Row: {
          config: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ceo_scratch_pad: {
        Row: {
          content: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
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
          reasoning: string | null
          source_archive_id: string | null
          suggested_assignee_id: string | null
          suggested_priority: string | null
          text: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          reasoning?: string | null
          source_archive_id?: string | null
          suggested_assignee_id?: string | null
          suggested_priority?: string | null
          text: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          reasoning?: string | null
          source_archive_id?: string | null
          suggested_assignee_id?: string | null
          suggested_priority?: string | null
          text?: string
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
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          attachments: Json
          author_id: string
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          mentions: string[]
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          content?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: string[]
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
          content: string
          created_at: string
          id: string
          image_url: string | null
          platform: string
          platform_label: string
          seed: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          brand_color?: string
          brand_id?: string | null
          brand_name: string
          canva_url?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          platform: string
          platform_label: string
          seed?: string
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
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          platform?: string
          platform_label?: string
          seed?: string
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_pinboard_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: string | null
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
          content?: string | null
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
          content?: string | null
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
            foreignKeyName: "documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      email_labels: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          gmail_label_id: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          gmail_label_id?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          gmail_label_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
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
      entity_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          id: string
          review_notes: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          template_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          template_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          template_id?: string
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
          created_by: string | null
          department_id: string | null
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          refresh_token_secret_id?: string
          revoked_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          alignment_notes: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          department_id: string | null
          description: string | null
          id: string
          key_results: Json | null
          measurable_target: string | null
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
          alignment_notes?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          key_results?: Json | null
          measurable_target?: string | null
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
          alignment_notes?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          key_results?: Json | null
          measurable_target?: string | null
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
      issues: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          department_id: string | null
          description: string | null
          discussion_notes: string | null
          id: string
          priority: number
          raised_by: string | null
          resolution: string | null
          resolved_action_id: string | null
          resolved_action_type: string | null
          root_cause: string | null
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
          description?: string | null
          discussion_notes?: string | null
          id?: string
          priority?: number
          raised_by?: string | null
          resolution?: string | null
          resolved_action_id?: string | null
          resolved_action_type?: string | null
          root_cause?: string | null
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
          description?: string | null
          discussion_notes?: string | null
          id?: string
          priority?: number
          raised_by?: string | null
          resolution?: string | null
          resolved_action_id?: string | null
          resolved_action_type?: string | null
          root_cause?: string | null
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
          from_user_id: string
          id: string
          message: string
          to_user_id: string
          workspace_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          from_user_id: string
          id?: string
          message?: string
          to_user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string
          to_user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kudos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_research: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          created_by: string | null
          custom_criteria: string | null
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
          custom_criteria?: string | null
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
          custom_criteria?: string | null
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
      markets: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: string | null
          id: string
          links: Json
          location: string | null
          name: string
          notes_html: string | null
          strategy: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          id?: string
          links?: Json
          location?: string | null
          name: string
          notes_html?: string | null
          strategy?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          id?: string
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
      note_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          converted_doc_id: string | null
          cover_url: string | null
          created_at: string
          folder: string | null
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
          content?: string | null
          converted_doc_id?: string | null
          cover_url?: string | null
          created_at?: string
          folder?: string | null
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
          content?: string | null
          converted_doc_id?: string | null
          cover_url?: string | null
          created_at?: string
          folder?: string | null
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
            foreignKeyName: "notes_converted_doc_id_fkey"
            columns: ["converted_doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "note_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
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
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
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
          department_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          options: Json
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          emoji?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          author_name: string | null
          content: string
          created_at: string
          gif_url: string | null
          id: string
          image_url: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          author_id: string
          author_name?: string | null
          content?: string
          created_at?: string
          gif_url?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          author_id?: string
          author_name?: string | null
          content?: string
          created_at?: string
          gif_url?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_workspace_id_fkey"
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
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          reports_to: string | null
          skills: string[] | null
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
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reports_to?: string | null
          skills?: string[] | null
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
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reports_to?: string | null
          skills?: string[] | null
          time_clock_enabled?: boolean
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assignees: string[]
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
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
          assignees?: string[]
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
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
          assignees?: string[]
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
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
      reminder_assignees: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          reminder_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          reminder_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          reminder_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_assignees_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assigned_to: string | null
          completed: boolean
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
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
      task_templates: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          description: string
          due_date_offset_days: number | null
          id: string
          priority: string
          recurrence_rule: Json | null
          subtasks: Json
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          description?: string
          due_date_offset_days?: number | null
          id?: string
          priority?: string
          recurrence_rule?: Json | null
          subtasks?: Json
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          description?: string
          due_date_offset_days?: number | null
          id?: string
          priority?: string
          recurrence_rule?: Json | null
          subtasks?: Json
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
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
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
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
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
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
      team_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          subject_user_id: string
          type: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          subject_user_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          subject_user_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          break_minutes: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          is_manual: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          is_manual?: boolean
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          is_manual?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
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
      user_favorites: {
        Row: {
          created_at: string
          icon: string
          id: string
          label: string
          sort_order: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
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
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          is_primary?: boolean
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
          sort_order: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          section: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          section?: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      widget_defaults: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          visible: boolean
          widget_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          visible?: boolean
          widget_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          visible?: boolean
          widget_id?: string
        }
        Relationships: []
      }
      widget_preferences: {
        Row: {
          column: number
          created_at: string
          id: string
          sort_order: number
          user_id: string
          visible: boolean
          widget_id: string
        }
        Insert: {
          column?: number
          created_at?: string
          id?: string
          sort_order?: number
          user_id: string
          visible?: boolean
          widget_id: string
        }
        Update: {
          column?: number
          created_at?: string
          id?: string
          sort_order?: number
          user_id?: string
          visible?: boolean
          widget_id?: string
        }
        Relationships: []
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
            foreignKeyName: "workspace_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addon_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_addons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          accent_color: string | null
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
      [_ in never]: never
    }
    Functions: {
      can_use_gmail: { Args: { _user_id: string }; Returns: boolean }
      get_user_workspace_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
