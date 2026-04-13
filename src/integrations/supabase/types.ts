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
      announcements: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: string | null
          created_at: string
          department_id: string | null
          id: string
          pinned: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          pinned?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          pinned?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
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
        }
        Relationships: []
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
        }
        Relationships: []
      }
      documents: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: string | null
          created_at: string
          id: string
          parent_id: string | null
          shared_with: Json | null
          tags: string[] | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          shared_with?: Json | null
          tags?: string[] | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          shared_with?: Json | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
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
      goals: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          owner_id: string | null
          progress: number
          quarter: string
          status: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          progress?: number
          quarter?: string
          status?: string
          title: string
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          progress?: number
          quarter?: string
          status?: string
          title?: string
          updated_at?: string
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
        ]
      }
      issues: {
        Row: {
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
          title: string
          updated_at: string
        }
        Insert: {
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
          title: string
          updated_at?: string
        }
        Update: {
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
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          reports_to: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reports_to?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reports_to?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        ]
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
        }
        Relationships: []
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
      workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
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
