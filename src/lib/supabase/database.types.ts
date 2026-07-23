export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectPipelineState =
  | "draft"
  | "uploading"
  | "preparing"
  | "understanding_gameplay"
  | "building_story"
  | "generating_voice"
  | "building_edit"
  | "rendering"
  | "checking_quality"
  | "ready_for_review"
  | "approved"
  | "failed"
  | "cancelled"
  | "archived"
  | "deleting";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          default_language: string;
          default_narrator_key: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          default_language?: string;
          default_narrator_key?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          default_language?: string;
          default_narrator_key?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          pipeline_state: ProjectPipelineState;
          target_language: string;
          failure_code: string | null;
          failure_message: string | null;
          archived_at: string | null;
          delete_requested_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          pipeline_state?: ProjectPipelineState;
          target_language?: string;
          failure_code?: string | null;
          failure_message?: string | null;
          archived_at?: string | null;
          delete_requested_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          pipeline_state?: ProjectPipelineState;
          target_language?: string;
          failure_code?: string | null;
          failure_message?: string | null;
          archived_at?: string | null;
          delete_requested_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_creative_settings: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          creative_direction:
            "balanced" | "funnier" | "more_dramatic" | "more_analytical";
          pacing: "relaxed" | "balanced" | "tight";
          narration_density: "light" | "balanced" | "detailed";
          gameplay_preservation:
            "preserve_more" | "balanced" | "cut_more_aggressively";
          target_length: "auto" | "shorter" | "standard" | "longer";
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["project_creative_settings"]["Row"]
        > & { project_id: string; version_number: number };
        Update: Partial<
          Database["public"]["Tables"]["project_creative_settings"]["Row"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { project_pipeline_state: ProjectPipelineState };
    CompositeTypes: Record<string, never>;
  };
};
