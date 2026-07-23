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

export type AssetType =
  | "original_source"
  | "proxy_video"
  | "extracted_audio"
  | "frame_samples"
  | "narration_audio"
  | "intermediate_render"
  | "final_video"
  | "captions"
  | "preview_image";

export type JobType =
  | "source_validation"
  | "media_probe"
  | "proxy_generation"
  | "coarse_analysis"
  | "candidate_detection"
  | "deep_analysis"
  | "story_generation"
  | "script_generation"
  | "voice_generation"
  | "edit_planning"
  | "render"
  | "quality_control"
  | "asset_deletion";

export type JobStatus =
  | "queued"
  | "leased"
  | "running"
  | "retry_scheduled"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AssetStatus =
  | "pending"
  | "uploading"
  | "available"
  | "failed"
  | "delete_pending"
  | "deleted";

export type CreativeDirection =
  "balanced" | "funnier" | "more_dramatic" | "more_analytical";
export type Pacing = "relaxed" | "balanced" | "tight";
export type NarrationDensity = "light" | "balanced" | "detailed";
export type GameplayPreservation =
  "preserve_more" | "balanced" | "cut_more_aggressively";
export type TargetLength = "auto" | "shorter" | "standard" | "longer";

export type StoryStatus = "pending" | "generating" | "generated" | "failed";
export type ScriptStatus = "pending" | "generating" | "generated" | "failed";
export type EditStatus = "pending" | "planning" | "ready" | "failed";
export type OutputVersionStatus =
  "pending" | "rendering" | "rendered" | "failed";
export type RenderStatus = "queued" | "running" | "succeeded" | "failed";
export type QcStatus =
  "not_started" | "running" | "passed" | "failed" | "skipped";

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
          source_asset_id: string | null;
          selected_story_version_id: string | null;
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
          source_asset_id?: string | null;
          selected_story_version_id?: string | null;
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
          source_asset_id?: string | null;
          selected_story_version_id?: string | null;
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
      assets: {
        Row: {
          id: string;
          project_id: string;
          asset_type: AssetType;
          status: AssetStatus;
          storage_provider: "r2";
          bucket: string;
          object_key: string;
          original_filename: string | null;
          content_type: string | null;
          byte_size: number | null;
          checksum_sha256: string | null;
          duration_ms: number | null;
          width: number | null;
          height: number | null;
          frame_rate: number | null;
          video_codec: string | null;
          audio_codec: string | null;
          /** App-validated object: upload details now, probe results later. */
          metadata: Json;
          available_at: string | null;
          delete_requested_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assets"]["Row"]> & {
          project_id: string;
          asset_type: AssetType;
          bucket: string;
          object_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Row"]>;
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
      story_versions: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          status: StoryStatus;
          is_selected: boolean;
          title: string | null;
          angle: string | null;
          summary: string | null;
          /** App-validated object; narrative structure (hook/setup/…). */
          structure: Json;
          generation_metadata: Json;
          created_by_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["story_versions"]["Row"]
        > & { project_id: string; version_number: number };
        Update: Partial<Database["public"]["Tables"]["story_versions"]["Row"]>;
        Relationships: [];
      };
      story_version_moments: {
        Row: {
          story_version_id: string;
          candidate_moment_id: string;
          story_role: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["story_version_moments"]["Row"]
        > & {
          story_version_id: string;
          candidate_moment_id: string;
          story_role: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["story_version_moments"]["Row"]
        >;
        Relationships: [];
      };
      script_versions: {
        Row: {
          id: string;
          project_id: string;
          story_version_id: string | null;
          creative_settings_id: string | null;
          version_number: number;
          status: ScriptStatus;
          language: string;
          character_id: string | null;
          /** Frozen resolved character config (second freeze point). */
          narrator_config: Json;
          full_text: string | null;
          generation_metadata: Json;
          created_by_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["script_versions"]["Row"]
        > & { project_id: string; version_number: number };
        Update: Partial<Database["public"]["Tables"]["script_versions"]["Row"]>;
        Relationships: [];
      };
      script_sections: {
        Row: {
          id: string;
          project_id: string;
          script_version_id: string;
          section_index: number;
          start_ms: number;
          end_ms: number;
          beat_label: string | null;
          text: string;
          status: "active" | "superseded" | "regenerating" | "failed";
          parent_section_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["script_sections"]["Row"]
        > & {
          project_id: string;
          script_version_id: string;
          section_index: number;
          start_ms: number;
          end_ms: number;
          text: string;
        };
        Update: Partial<Database["public"]["Tables"]["script_sections"]["Row"]>;
        Relationships: [];
      };
      narration_assets: {
        Row: {
          id: string;
          project_id: string;
          script_section_id: string;
          asset_id: string | null;
          status:
            "pending" | "generating" | "available" | "failed" | "superseded";
          duration_ms: number | null;
          voice_provider: string | null;
          /** Frozen resolved voice config used for this narration. */
          voice_config: Json;
          generation_metadata: Json;
          created_by_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["narration_assets"]["Row"]
        > & { project_id: string; script_section_id: string };
        Update: Partial<
          Database["public"]["Tables"]["narration_assets"]["Row"]
        >;
        Relationships: [];
      };
      edit_versions: {
        Row: {
          id: string;
          project_id: string;
          story_version_id: string | null;
          script_version_id: string | null;
          creative_settings_id: string | null;
          version_number: number;
          status: EditStatus;
          edl_schema_version: number;
          timeline_duration_ms: number | null;
          summary: string | null;
          /** Structured, versioned edit plan (the Edit Decision List). */
          edl: Json;
          created_by_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["edit_versions"]["Row"]
        > & { project_id: string; version_number: number };
        Update: Partial<Database["public"]["Tables"]["edit_versions"]["Row"]>;
        Relationships: [];
      };
      edit_segments: {
        Row: {
          id: string;
          project_id: string;
          edit_version_id: string;
          segment_index: number;
          segment_type: string;
          output_start_ms: number;
          output_end_ms: number;
          source_asset_id: string | null;
          source_start_ms: number | null;
          source_end_ms: number | null;
          candidate_moment_id: string | null;
          script_section_id: string | null;
          included: boolean;
          effect_summary: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["edit_segments"]["Row"]
        > & {
          project_id: string;
          edit_version_id: string;
          segment_index: number;
          segment_type: string;
          output_start_ms: number;
          output_end_ms: number;
        };
        Update: Partial<Database["public"]["Tables"]["edit_segments"]["Row"]>;
        Relationships: [];
      };
      output_versions: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          status: OutputVersionStatus;
          story_version_id: string | null;
          script_version_id: string | null;
          edit_version_id: string | null;
          creative_settings_id: string | null;
          final_asset_id: string | null;
          qc_status: QcStatus;
          is_current: boolean;
          is_approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          change_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["output_versions"]["Row"]
        > & { project_id: string; version_number: number };
        Update: Partial<Database["public"]["Tables"]["output_versions"]["Row"]>;
        Relationships: [];
      };
      render_attempts: {
        Row: {
          id: string;
          project_id: string;
          output_version_id: string;
          job_id: string | null;
          attempt_number: number;
          status: RenderStatus;
          edit_version_id: string | null;
          output_asset_id: string | null;
          intermediate_asset_id: string | null;
          technical_metadata: Json;
          error_code: string | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["render_attempts"]["Row"]
        > & {
          project_id: string;
          output_version_id: string;
          attempt_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["render_attempts"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      /** Sanitized owner-scoped job state (migration 004). */
      public_user_jobs: {
        Row: {
          id: string;
          project_id: string;
          job_type: JobType;
          status: JobStatus;
          attempt_count: number;
          max_attempts: number;
          progress_percent: number | null;
          progress_stage: string | null;
          current_activity: string | null;
          error_code: string | null;
          error_message: string | null;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      enqueue_job: {
        Args: {
          p_project_id: string;
          p_job_type: JobType;
          p_idempotency_key: string;
          p_payload?: Json;
          p_priority?: number;
          p_parent_job_id?: string | null;
        };
        Returns: string;
      };
      retry_job: {
        Args: { p_job_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      project_pipeline_state: ProjectPipelineState;
      asset_type: AssetType;
      asset_status: AssetStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectCreativeSettingsRow =
  Database["public"]["Tables"]["project_creative_settings"]["Row"];
export type CharacterRow = Database["public"]["Tables"]["characters"]["Row"];
export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
export type StoryVersionRow =
  Database["public"]["Tables"]["story_versions"]["Row"];
export type StoryVersionMomentRow =
  Database["public"]["Tables"]["story_version_moments"]["Row"];
export type ScriptVersionRow =
  Database["public"]["Tables"]["script_versions"]["Row"];
export type ScriptSectionRow =
  Database["public"]["Tables"]["script_sections"]["Row"];
export type NarrationAssetRow =
  Database["public"]["Tables"]["narration_assets"]["Row"];
export type EditVersionRow =
  Database["public"]["Tables"]["edit_versions"]["Row"];
export type EditSegmentRow =
  Database["public"]["Tables"]["edit_segments"]["Row"];
export type OutputVersionRow =
  Database["public"]["Tables"]["output_versions"]["Row"];
export type RenderAttemptRow =
  Database["public"]["Tables"]["render_attempts"]["Row"];
export type UserJobRow = Database["public"]["Views"]["public_user_jobs"]["Row"];
