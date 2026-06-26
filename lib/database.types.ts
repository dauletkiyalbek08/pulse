export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          project_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          project_id: string
          source: string | null
          status: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          project_id: string
          source?: string | null
          status?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          project_id?: string
          source?: string | null
          status?: string
          value?: number | null
        }
        Relationships: []
      }
      metrics_daily: {
        Row: {
          ad_spend: number
          date: string
          id: string
          leads: number
          project_id: string
          qualified: number
          revenue: number
          sales: number
          trial_lessons: number
        }
        Insert: {
          ad_spend?: number
          date: string
          id?: string
          leads?: number
          project_id: string
          qualified?: number
          revenue?: number
          sales?: number
          trial_lessons?: number
        }
        Update: {
          ad_spend?: number
          date?: string
          id?: string
          leads?: number
          project_id?: string
          qualified?: number
          revenue?: number
          sales?: number
          trial_lessons?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          project_id: string
          sale_price: number
          sku: string | null
          stock_quantity: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          project_id: string
          sale_price?: number
          sku?: string | null
          stock_quantity?: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          project_id?: string
          sale_price?: number
          sku?: string | null
          stock_quantity?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          global_role: string
          id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          global_role?: string
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          global_role?: string
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          fired_at: string | null
          hired_at: string
          id: string
          project_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          fired_at?: string | null
          hired_at?: string
          id?: string
          project_id: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          fired_at?: string | null
          hired_at?: string
          id?: string
          project_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          accent_color: string | null
          created_at: string
          description: string | null
          director_name: string | null
          icon: string | null
          id: string
          name: string
          niche: string
          owner_id: string
          plan: string
          status: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          director_name?: string | null
          icon?: string | null
          id?: string
          name: string
          niche: string
          owner_id: string
          plan?: string
          status?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          director_name?: string | null
          icon?: string | null
          id?: string
          name?: string
          niche?: string
          owner_id?: string
          plan?: string
          status?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          created_at: string
          id: string
          lead_id: string | null
          manager_id: string | null
          product: string | null
          project_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          product?: string | null
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          product?: string | null
          project_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_owner: { Args: Record<string, never>; Returns: boolean }
      is_project_member: { Args: { pid: string }; Returns: boolean }
      create_employee: {
        Args: { p_project_id: string; p_full_name: string; p_role: string }
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
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
