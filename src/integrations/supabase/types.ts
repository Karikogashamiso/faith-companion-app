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
      ai_study_logs: {
        Row: {
          answer: string
          created_at: string
          crisis_level: string
          id: string
          model: string
          question: string
          retrieved_refs: Json
          stripped_refs: Json
          tradition: Database["public"]["Enums"]["tradition"]
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          crisis_level: string
          id?: string
          model: string
          question: string
          retrieved_refs?: Json
          stripped_refs?: Json
          tradition: Database["public"]["Enums"]["tradition"]
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          crisis_level?: string
          id?: string
          model?: string
          question?: string
          retrieved_refs?: Json
          stripped_refs?: Json
          tradition?: Database["public"]["Enums"]["tradition"]
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          count?: number
          usage_date: string
          user_id: string
        }
        Update: {
          count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          props: Json
          user_id: string
          variant_screen1: string | null
          variant_screen10: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          props?: Json
          user_id: string
          variant_screen1?: string | null
          variant_screen10?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          props?: Json
          user_id?: string
          variant_screen1?: string | null
          variant_screen10?: string | null
        }
        Relationships: []
      }
      bible_versions: {
        Row: {
          abbreviation: string
          created_at: string
          id: string
          is_public_domain: boolean
          language: string
          license_notes: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          id?: string
          is_public_domain?: boolean
          language?: string
          license_notes: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          id?: string
          is_public_domain?: boolean
          language?: string
          license_notes?: string
          name?: string
        }
        Relationships: []
      }
      churches: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          activity_date: string
          created_at: string
          source: string
          user_id: string
        }
        Insert: {
          activity_date: string
          created_at?: string
          source?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          expires_at: string | null
          product_id: string | null
          rc_app_user_id: string | null
          source: string | null
          store: string | null
          tier: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          product_id?: string | null
          rc_app_user_id?: string | null
          source?: string | null
          store?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          product_id?: string | null
          rc_app_user_id?: string | null
          source?: string | null
          store?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          active_plan_id: string | null
          church_id: string | null
          created_at: string
          id: string
          join_code: string
          name: string
          owner_id: string
        }
        Insert: {
          active_plan_id?: string | null
          church_id?: string | null
          created_at?: string
          id?: string
          join_code: string
          name: string
          owner_id: string
        }
        Update: {
          active_plan_id?: string | null
          church_id?: string | null
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_active_plan_id_fkey"
            columns: ["active_plan_id"]
            isOneToOne: false
            referencedRelation: "reading_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          id: string
          kind: string
          sent_at: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          sent_at?: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          sent_at?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_answers: {
        Row: {
          completed_at: string | null
          daily_minutes: number | null
          goal: string | null
          join_code: string | null
          journey_stage: string | null
          reminder_time: string | null
          struggles: string[]
          updated_at: string
          user_id: string
          variant_screen1: string | null
          variant_screen10: string | null
        }
        Insert: {
          completed_at?: string | null
          daily_minutes?: number | null
          goal?: string | null
          join_code?: string | null
          journey_stage?: string | null
          reminder_time?: string | null
          struggles?: string[]
          updated_at?: string
          user_id: string
          variant_screen1?: string | null
          variant_screen10?: string | null
        }
        Update: {
          completed_at?: string | null
          daily_minutes?: number | null
          goal?: string | null
          join_code?: string | null
          journey_stage?: string | null
          reminder_time?: string | null
          struggles?: string[]
          updated_at?: string
          user_id?: string
          variant_screen1?: string | null
          variant_screen10?: string | null
        }
        Relationships: []
      }
      plan_days: {
        Row: {
          day_number: number
          id: string
          passage_ref: string
          plan_id: string
          prayer_md: string | null
          reflection_md: string | null
        }
        Insert: {
          day_number: number
          id?: string
          passage_ref: string
          plan_id: string
          prayer_md?: string | null
          reflection_md?: string | null
        }
        Update: {
          day_number?: number
          id?: string
          passage_ref?: string
          plan_id?: string
          prayer_md?: string | null
          reflection_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "reading_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          answered_at: string | null
          author_id: string
          body: string
          created_at: string
          group_id: string
          id: string
          status: Database["public"]["Enums"]["prayer_status"]
          testimony: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          author_id: string
          body: string
          created_at?: string
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["prayer_status"]
          testimony?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          author_id?: string
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["prayer_status"]
          testimony?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_responses: {
        Row: {
          created_at: string
          id: string
          note: string | null
          prayed: boolean
          request_id: string
          responder_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          prayed?: boolean
          request_id: string
          responder_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          prayed?: boolean
          request_id?: string
          responder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "prayer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_enabled: boolean
          created_at: string
          daily_minutes: number | null
          default_version_id: string | null
          display_name: string | null
          id: string
          notification_time: string | null
          reminder_time: string | null
          share_progress: boolean
          tradition: Database["public"]["Enums"]["tradition"]
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          created_at?: string
          daily_minutes?: number | null
          default_version_id?: string | null
          display_name?: string | null
          id: string
          notification_time?: string | null
          reminder_time?: string | null
          share_progress?: boolean
          tradition?: Database["public"]["Enums"]["tradition"]
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          created_at?: string
          daily_minutes?: number | null
          default_version_id?: string | null
          display_name?: string | null
          id?: string
          notification_time?: string | null
          reminder_time?: string | null
          share_progress?: boolean
          tradition?: Database["public"]["Enums"]["tradition"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_version_id_fkey"
            columns: ["default_version_id"]
            isOneToOne: false
            referencedRelation: "bible_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_plans: {
        Row: {
          created_at: string
          day_count: number
          description: string | null
          id: string
          is_premium: boolean
          title: string
          tradition: Database["public"]["Enums"]["tradition"] | null
        }
        Insert: {
          created_at?: string
          day_count: number
          description?: string | null
          id?: string
          is_premium?: boolean
          title: string
          tradition?: Database["public"]["Enums"]["tradition"] | null
        }
        Update: {
          created_at?: string
          day_count?: number
          description?: string | null
          id?: string
          is_premium?: boolean
          title?: string
          tradition?: Database["public"]["Enums"]["tradition"] | null
        }
        Relationships: []
      }
      user_highlights: {
        Row: {
          color: string
          created_at: string
          id: string
          note: string | null
          user_id: string
          verse_id: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
          verse_id: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
          verse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_highlights_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plan_progress: {
        Row: {
          completed_at: string
          day_completed: number
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          day_completed: number
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          day_completed?: number
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plan_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "reading_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verses: {
        Row: {
          book: string
          chapter: number
          embedded_at: string | null
          embedding: string | null
          id: number
          text: string
          verse: number
          version_id: string
        }
        Insert: {
          book: string
          chapter: number
          embedded_at?: string | null
          embedding?: string | null
          id?: number
          text: string
          verse: number
          version_id: string
        }
        Update: {
          book?: string
          chapter?: number
          embedded_at?: string | null
          embedding?: string | null
          id?: number
          text?: string
          verse?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verses_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "bible_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_companion: { Args: { _user_id: string }; Returns: boolean }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_by_code: { Args: { _code: string }; Returns: string }
      match_verses: {
        Args: {
          match_count?: number
          p_version_id: string
          query_embedding: string
          query_text: string
        }
        Returns: {
          book: string
          chapter: number
          id: number
          score: number
          text: string
          verse: number
        }[]
      }
      shares_group_with: { Args: { _a: string; _b: string }; Returns: boolean }
      verse_of_the_day: {
        Args: { p_date?: string; p_version_id: string }
        Returns: {
          book: string
          chapter: number
          id: number
          text: string
          verse: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      group_role: "owner" | "member"
      prayer_status: "open" | "answered" | "archived"
      tradition:
        | "catholic"
        | "orthodox"
        | "reformed"
        | "baptist"
        | "methodist"
        | "lutheran"
        | "pentecostal"
        | "anglican"
        | "non_denominational"
        | "other"
        | "unspecified"
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
      app_role: ["admin", "moderator", "user"],
      group_role: ["owner", "member"],
      prayer_status: ["open", "answered", "archived"],
      tradition: [
        "catholic",
        "orthodox",
        "reformed",
        "baptist",
        "methodist",
        "lutheran",
        "pentecostal",
        "anglican",
        "non_denominational",
        "other",
        "unspecified",
      ],
    },
  },
} as const
