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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          server_id: string
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          server_id: string
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          server_id?: string
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number | null
          server_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number | null
          server_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_categories_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_locked: boolean | null
          name: string
          position: number
          server_id: string
          slow_mode_interval: number | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean | null
          name: string
          position?: number
          server_id: string
          slow_mode_interval?: number | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean | null
          name?: string
          position?: number
          server_id?: string
          slow_mode_interval?: number | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          id: string
          inserted_at: string
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content?: string
          conversation_id: string
          id?: string
          inserted_at?: string
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          id?: string
          inserted_at?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_conversations: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          author_name: string | null
          channel_id: string
          content: string
          edited_at: string | null
          id: string
          inserted_at: string
          is_pinned: boolean | null
          parent_id: string | null
          reply_to: string | null
          server_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          author_name?: string | null
          channel_id: string
          content?: string
          edited_at?: string | null
          id?: string
          inserted_at?: string
          is_pinned?: boolean | null
          parent_id?: string | null
          reply_to?: string | null
          server_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          author_name?: string | null
          channel_id?: string
          content?: string
          edited_at?: string | null
          id?: string
          inserted_at?: string
          is_pinned?: boolean | null
          parent_id?: string | null
          reply_to?: string | null
          server_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          dm_notifications: boolean | null
          id: string
          mention_notifications: boolean | null
          push_enabled: boolean | null
          server_notifications: boolean | null
          sound_enabled: boolean | null
          user_id: string
        }
        Insert: {
          dm_notifications?: boolean | null
          id?: string
          mention_notifications?: boolean | null
          push_enabled?: boolean | null
          server_notifications?: boolean | null
          sound_enabled?: boolean | null
          user_id: string
        }
        Update: {
          dm_notifications?: boolean | null
          id?: string
          mention_notifications?: boolean | null
          push_enabled?: boolean | null
          server_notifications?: boolean | null
          sound_enabled?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          afk_reason: string | null
          allow_dms: boolean
          avatar_url: string | null
          banner_color: string | null
          bio: string | null
          custom_status: string | null
          display_name: string | null
          friend_request_setting: string
          has_premium_badge: boolean | null
          id: string
          is_afk: boolean | null
          language: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          username: string
        }
        Insert: {
          afk_reason?: string | null
          allow_dms?: boolean
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          custom_status?: string | null
          display_name?: string | null
          friend_request_setting?: string
          has_premium_badge?: boolean | null
          id: string
          is_afk?: boolean | null
          language?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username: string
        }
        Update: {
          afk_reason?: string | null
          allow_dms?: boolean
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          custom_status?: string | null
          display_name?: string | null
          friend_request_setting?: string
          has_premium_badge?: boolean | null
          id?: string
          is_afk?: boolean | null
          language?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      server_bans: {
        Row: {
          banned_by: string | null
          created_at: string | null
          id: string
          reason: string | null
          server_id: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          server_id: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_bans_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      server_emojis: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          name: string
          server_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          name: string
          server_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          name?: string
          server_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_emojis_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_emojis_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      server_invites: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          server_id: string
          uses: number | null
        }
        Insert: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          server_id: string
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          server_id?: string
          uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "server_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_invites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_member_roles: {
        Row: {
          id: string
          member_id: string
          role_id: string
        }
        Insert: {
          id?: string
          member_id: string
          role_id: string
        }
        Update: {
          id?: string
          member_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "server_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "server_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      server_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          server_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          server_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      server_roles: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          permissions: Json | null
          position: number | null
          server_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          permissions?: Json | null
          position?: number | null
          server_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          position?: number | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          created_at: string
          icon: string | null
          icon_url: string | null
          id: string
          invite_code: string
          leave_channel_id: string | null
          leave_enabled: boolean | null
          leave_message: string | null
          name: string
          owner_id: string
          welcome_channel_id: string | null
          welcome_enabled: boolean | null
          welcome_message: string | null
          word_filter: Json | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string
          leave_channel_id?: string | null
          leave_enabled?: boolean | null
          leave_message?: string | null
          name: string
          owner_id: string
          welcome_channel_id?: string | null
          welcome_enabled?: boolean | null
          welcome_message?: string | null
          word_filter?: Json | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string
          leave_channel_id?: string | null
          leave_enabled?: boolean | null
          leave_message?: string | null
          name?: string
          owner_id?: string
          welcome_channel_id?: string | null
          welcome_enabled?: boolean | null
          welcome_message?: string | null
          word_filter?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servers_welcome_channel_id_fkey"
            columns: ["welcome_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          attachments: Json | null
          content: string
          id: string
          inserted_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content?: string
          id?: string
          inserted_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          id?: string
          inserted_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          message_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          message_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_server_message: {
        Args: { p_message_id: string }
        Returns: boolean
      }
      is_dm_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_server_permission: {
        Args: { p_user_id: string; p_server_id: string; p_permission: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      channel_type: "text" | "voice"
      member_role: "owner" | "admin" | "member"
      user_status: "online" | "offline" | "idle" | "dnd"
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
      channel_type: ["text", "voice"],
      member_role: ["owner", "admin", "member"],
      user_status: ["online", "offline", "idle", "dnd"],
    },
  },
} as const
