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

export type CreativeDirection =
  "balanced" | "funnier" | "more_dramatic" | "more_analytical";
export type Pacing = "relaxed" | "balanced" | "tight";
export type NarrationDensity = "light" | "balanced" | "detailed";
export type GameplayPreservation =
  "preserve_more" | "balanced" | "cut_more_aggressively";
export type TargetLength = "auto" | "shorter" | "standard" | "longer";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          default_language: string;
          /** Deprecated — superseded by default_character_id. */
          default_narrator_key: string | null;
          default_character_id: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          default_language?: string;
          default_narrator_key?: string | null;
          default_character_id?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          default_language?: string;
          default_narrator_key?: string | null;
          default_character_id?: string | null;
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
          channel_id: string | null;
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
          channel_id?: string | null;
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
          channel_id?: string | null;
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
          creative_direction: CreativeDirection;
          pacing: Pacing;
          narration_density: NarrationDensity;
          gameplay_preservation: GameplayPreservation;
          target_length: TargetLength;
          character_id: string | null;
          edit_style: Json;
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
      characters: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          language: string;
          voice_provider: "elevenlabs";
          voice_key: string | null;
          /** Object; expected keys: model_id, stability, similarity_boost, style, speed. */
          voice_settings: Json;
          /** Object; expected keys: tone, humor_level, energy, sentence_length, vocabulary_notes, catchphrases[], forbidden_words[], example_lines[]. */
          speech_style: Json;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["characters"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["characters"]["Row"]>;
        Relationships: [];
      };
      channels: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          youtube_handle: string | null;
          description: string | null;
          default_character_id: string | null;
          default_language: string;
          creative_direction: CreativeDirection;
          pacing: Pacing;
          narration_density: NarrationDensity;
          gameplay_preservation: GameplayPreservation;
          target_length: TargetLength;
          /** Object of enumerated tokens; expected keys: caption_style, zoom_usage, transition_style, intro_style, outro_style. */
          edit_style: Json;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["channels"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["channels"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { project_pipeline_state: ProjectPipelineState };
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectCreativeSettingsRow =
  Database["public"]["Tables"]["project_creative_settings"]["Row"];
export type CharacterRow = Database["public"]["Tables"]["characters"]["Row"];
export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
