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
      bets: {
        Row: {
          id: number
          manually_updated_at: string | null
          match_id: number
          placed_at: string
          points_awarded: number | null
          predicted_advancer: Database["public"]["Enums"]["bet_outcome"] | null
          predicted_away_score: number
          predicted_home_score: number
          predicted_outcome: Database["public"]["Enums"]["bet_outcome"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: never
          manually_updated_at?: string | null
          match_id: number
          placed_at?: string
          points_awarded?: number | null
          predicted_advancer?: Database["public"]["Enums"]["bet_outcome"] | null
          predicted_away_score: number
          predicted_home_score: number
          predicted_outcome?: Database["public"]["Enums"]["bet_outcome"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: never
          manually_updated_at?: string | null
          match_id?: number
          placed_at?: string
          points_awarded?: number | null
          predicted_advancer?: Database["public"]["Enums"]["bet_outcome"] | null
          predicted_away_score?: number
          predicted_home_score?: number
          predicted_outcome?: Database["public"]["Enums"]["bet_outcome"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          correct_outcomes: number
          exact_scores: number
          last_updated: string
          total_points: number
          user_id: string
        }
        Insert: {
          correct_outcomes?: number
          exact_scores?: number
          last_updated?: string
          total_points?: number
          user_id: string
        }
        Update: {
          correct_outcomes?: number
          exact_scores?: number
          last_updated?: string
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          advancer: Database["public"]["Enums"]["bet_outcome"] | null
          away_penalties: number | null
          away_score: number | null
          away_team_id: number | null
          created_at: string
          estimated_end_time: string | null
          goals: Json | null
          home_penalties: number | null
          home_score: number | null
          home_team_id: number | null
          id: number
          minute: string | null
          outcome: Database["public"]["Enums"]["bet_outcome"] | null
          phase: string | null
          provider_event_id: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          start_time: string
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          advancer?: Database["public"]["Enums"]["bet_outcome"] | null
          away_penalties?: number | null
          away_score?: number | null
          away_team_id?: number | null
          created_at?: string
          estimated_end_time?: string | null
          goals?: Json | null
          home_penalties?: number | null
          home_score?: number | null
          home_team_id?: number | null
          id?: never
          minute?: string | null
          outcome?: Database["public"]["Enums"]["bet_outcome"] | null
          phase?: string | null
          provider_event_id?: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          start_time: string
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          advancer?: Database["public"]["Enums"]["bet_outcome"] | null
          away_penalties?: number | null
          away_score?: number | null
          away_team_id?: number | null
          created_at?: string
          estimated_end_time?: string | null
          goals?: Json | null
          home_penalties?: number | null
          home_score?: number | null
          home_team_id?: number | null
          id?: never
          minute?: string | null
          outcome?: Database["public"]["Enums"]["bet_outcome"] | null
          phase?: string | null
          provider_event_id?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          start_time?: string
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          api_name: string | null
          code: string
          flag_url: string | null
          id: number
          name: string
          name_en: string | null
          name_es: string | null
        }
        Insert: {
          api_name?: string | null
          code: string
          flag_url?: string | null
          id?: never
          name: string
          name_en?: string | null
          name_es?: string | null
        }
        Update: {
          api_name?: string | null
          code?: string
          flag_url?: string | null
          id?: never
          name?: string
          name_en?: string | null
          name_es?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      match_winners: {
        Row: {
          manually_updated_at: string | null
          match_id: number | null
          placed_at: string | null
          points_awarded: number | null
          position: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_betting_open: { Args: { p_match_id: number }; Returns: boolean }
      refresh_leaderboard_for_match: {
        Args: { p_match_id: number }
        Returns: undefined
      }
      score_bets_for_match: {
        Args: { p_match_id: number }
        Returns: undefined
      }
      search_match_ids: {
        Args: { p_lang?: string; p_query: string }
        Returns: {
          match_id: number
        }[]
      }
      sync_matches_from_api: { Args: never; Returns: number }
    }
    Enums: {
      bet_outcome: "home" | "draw" | "away"
      match_stage:
        | "group_a"
        | "group_b"
        | "group_c"
        | "group_d"
        | "group_e"
        | "group_f"
        | "group_g"
        | "group_h"
        | "group_i"
        | "group_j"
        | "group_k"
        | "group_l"
        | "round_of_32"
        | "round_of_16"
        | "quarter_final"
        | "semi_final"
        | "third_place"
        | "final"
      match_status: "scheduled" | "live" | "finished" | "cancelled"
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
      bet_outcome: ["home", "draw", "away"],
      match_stage: [
        "group_a",
        "group_b",
        "group_c",
        "group_d",
        "group_e",
        "group_f",
        "group_g",
        "group_h",
        "group_i",
        "group_j",
        "group_k",
        "group_l",
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
      ],
      match_status: ["scheduled", "live", "finished", "cancelled"],
    },
  },
} as const
