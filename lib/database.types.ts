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
      finance_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          project_id: string
          spent_on: string
          title: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          project_id: string
          spent_on?: string
          title: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          project_id?: string
          spent_on?: string
          title?: string
        }
        Relationships: []
      }
      ad_launch_config: {
        Row: {
          project_id: string
          country: string
          age_min: number
          age_max: number
          gender: string
          daily_budget_usd: number
          destination_url: string | null
          page_id: string | null
          objective: string
          updated_at: string
        }
        Insert: {
          project_id: string
          country?: string
          age_min?: number
          age_max?: number
          gender?: string
          daily_budget_usd?: number
          destination_url?: string | null
          page_id?: string | null
          objective?: string
          updated_at?: string
        }
        Update: {
          project_id?: string
          country?: string
          age_min?: number
          age_max?: number
          gender?: string
          daily_budget_usd?: number
          destination_url?: string | null
          page_id?: string | null
          objective?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_launches: {
        Row: {
          id: string
          project_id: string
          created_by: string | null
          chat_id: number
          purpose: string
          tg_file_id: string | null
          meta_video_id: string | null
          thumb_url: string | null
          offer: string | null
          primary_text: string | null
          headline: string | null
          budget_usd: number
          campaign_id: string | null
          adset_id: string | null
          ad_id: string | null
          status: string
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          created_by?: string | null
          chat_id: number
          purpose?: string
          tg_file_id?: string | null
          meta_video_id?: string | null
          thumb_url?: string | null
          offer?: string | null
          primary_text?: string | null
          headline?: string | null
          budget_usd?: number
          campaign_id?: string | null
          adset_id?: string | null
          ad_id?: string | null
          status?: string
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          created_by?: string | null
          chat_id?: number
          purpose?: string
          tg_file_id?: string | null
          meta_video_id?: string | null
          thumb_url?: string | null
          offer?: string | null
          primary_text?: string | null
          headline?: string | null
          budget_usd?: number
          campaign_id?: string | null
          adset_id?: string | null
          ad_id?: string | null
          status?: string
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          amount: number
          campaign: string
          channel: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          leads: number
          note: string | null
          objective: string
          project_id: string
          source: string
          spent_on: string
        }
        Insert: {
          amount?: number
          campaign: string
          channel?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          leads?: number
          note?: string | null
          objective?: string
          project_id: string
          source?: string
          spent_on?: string
        }
        Update: {
          amount?: number
          campaign?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          leads?: number
          note?: string | null
          objective?: string
          project_id?: string
          source?: string
          spent_on?: string
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          channel: string
          clicks: number
          currency: string
          external_id: string | null
          id: string
          impressions: number
          leads: number
          meta_objective: string | null
          name: string
          objective: string
          period_from: string | null
          period_to: string | null
          project_id: string
          reach: number
          spend: number
          status: string
          synced_at: string
        }
        Insert: {
          channel?: string
          clicks?: number
          currency?: string
          external_id?: string | null
          id?: string
          impressions?: number
          leads?: number
          meta_objective?: string | null
          name: string
          objective?: string
          period_from?: string | null
          period_to?: string | null
          project_id: string
          reach?: number
          spend?: number
          status?: string
          synced_at?: string
        }
        Update: {
          channel?: string
          clicks?: number
          currency?: string
          external_id?: string | null
          id?: string
          impressions?: number
          leads?: number
          meta_objective?: string | null
          name?: string
          objective?: string
          period_from?: string | null
          period_to?: string | null
          project_id?: string
          reach?: number
          spend?: number
          status?: string
          synced_at?: string
        }
        Relationships: []
      }
      meta_integration: {
        Row: {
          ad_account_id: string
          connected_by: string | null
          created_at: string
          currency: string
          kzt_rate: number
          last_error: string | null
          last_synced_at: string | null
          project_id: string
          purpose: string
          status: string
          token_enc: string
        }
        Insert: {
          ad_account_id: string
          connected_by?: string | null
          created_at?: string
          currency?: string
          kzt_rate?: number
          last_error?: string | null
          last_synced_at?: string | null
          project_id: string
          purpose?: string
          status?: string
          token_enc: string
        }
        Update: {
          ad_account_id?: string
          connected_by?: string | null
          created_at?: string
          currency?: string
          kzt_rate?: number
          last_error?: string | null
          last_synced_at?: string | null
          project_id?: string
          purpose?: string
          status?: string
          token_enc?: string
        }
        Relationships: []
      }
      meta_pages: {
        Row: {
          created_at: string
          name: string | null
          page_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          name?: string | null
          page_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          name?: string | null
          page_id?: string
          project_id?: string
        }
        Relationships: []
      }
      payroll: {
        Row: {
          base_salary: number
          bonus: number
          created_at: string
          days_planned: number
          days_worked: number
          deduction: number
          id: string
          kpi_bonus: number
          note: string | null
          period: string
          project_id: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          base_salary?: number
          bonus?: number
          created_at?: string
          days_planned?: number
          days_worked?: number
          deduction?: number
          id?: string
          kpi_bonus?: number
          note?: string | null
          period: string
          project_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          base_salary?: number
          bonus?: number
          created_at?: string
          days_planned?: number
          days_worked?: number
          deduction?: number
          id?: string
          kpi_bonus?: number
          note?: string | null
          period?: string
          project_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          accepted_at: string | null
          ad_id: string | null
          adset_id: string | null
          assigned_at: string | null
          assigned_to: string | null
          campaign_id: string | null
          created_at: string
          external_id: string | null
          fbc: string | null
          fbp: string | null
          form_id: string | null
          full_name: string
          id: string
          note: string | null
          phone: string | null
          project_id: string
          source: string | null
          status: string
          value: number | null
        }
        Insert: {
          accepted_at?: string | null
          ad_id?: string | null
          adset_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          campaign_id?: string | null
          created_at?: string
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          form_id?: string | null
          full_name: string
          id?: string
          note?: string | null
          phone?: string | null
          project_id: string
          source?: string | null
          status?: string
          value?: number | null
        }
        Update: {
          accepted_at?: string | null
          ad_id?: string | null
          adset_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          campaign_id?: string | null
          created_at?: string
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          form_id?: string | null
          full_name?: string
          id?: string
          note?: string | null
          phone?: string | null
          project_id?: string
          source?: string | null
          status?: string
          value?: number | null
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          lead_id: string
          project_id: string
          text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          project_id: string
          text: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          project_id?: string
          text?: string
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
          modules: string[] | null
          name: string
          niche: string
          niche_label: string | null
          office_address: string | null
          office_lat: number | null
          office_lng: number | null
          office_radius_m: number
          owner_id: string
          plan: string
          site_token: string
          status: string
          usd_rate: number
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          director_name?: string | null
          icon?: string | null
          id?: string
          modules?: string[] | null
          name: string
          niche: string
          niche_label?: string | null
          office_address?: string | null
          office_lat?: number | null
          office_lng?: number | null
          office_radius_m?: number
          owner_id: string
          plan?: string
          site_token?: string
          status?: string
          usd_rate?: number
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          director_name?: string | null
          icon?: string | null
          id?: string
          modules?: string[] | null
          name?: string
          niche?: string
          niche_label?: string | null
          office_address?: string | null
          office_lat?: number | null
          office_lng?: number | null
          office_radius_m?: number
          owner_id?: string
          plan?: string
          site_token?: string
          status?: string
          usd_rate?: number
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          manager_id: string | null
          product: string | null
          project_id: string
          receipt_file_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          product?: string | null
          project_id: string
          receipt_file_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          product?: string | null
          project_id?: string
          receipt_file_id?: string | null
        }
        Relationships: []
      }
      call_ai_config: {
        Row: {
          api_key_enc: string | null
          asr_key_enc: string | null
          asr_model: string
          connected_by: string | null
          created_at: string
          hunter_rules: string
          last_error: string | null
          model: string
          project_id: string
          provider: string
          sales_rules: string
          status: string
        }
        Insert: {
          api_key_enc?: string | null
          asr_key_enc?: string | null
          asr_model?: string
          connected_by?: string | null
          created_at?: string
          hunter_rules?: string
          last_error?: string | null
          model?: string
          project_id: string
          provider?: string
          sales_rules?: string
          status?: string
        }
        Update: {
          api_key_enc?: string | null
          asr_key_enc?: string | null
          asr_model?: string
          connected_by?: string | null
          created_at?: string
          hunter_rules?: string
          last_error?: string | null
          model?: string
          project_id?: string
          provider?: string
          sales_rules?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_config_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      call_analyses: {
        Row: {
          audio_seconds: number | null
          created_at: string
          created_by: string | null
          criteria: Json
          employee_id: string | null
          id: string
          issues: Json
          lead_id: string | null
          overall_score: number
          project_id: string
          recommendations: Json
          role_type: string
          source: string
          strengths: Json
          summary: string | null
          transcript: string
        }
        Insert: {
          audio_seconds?: number | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          employee_id?: string | null
          id?: string
          issues?: Json
          lead_id?: string | null
          overall_score?: number
          project_id: string
          recommendations?: Json
          role_type?: string
          source?: string
          strengths?: Json
          summary?: string | null
          transcript: string
        }
        Update: {
          audio_seconds?: number | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          employee_id?: string | null
          id?: string
          issues?: Json
          lead_id?: string | null
          overall_score?: number
          project_id?: string
          recommendations?: Json
          role_type?: string
          source?: string
          strengths?: Json
          summary?: string | null
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_analyses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          asr_model: string
          deepseek_key_enc: string | null
          deepseek_model: string
          id: number
          openai_key_enc: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asr_model?: string
          deepseek_key_enc?: string | null
          deepseek_model?: string
          id?: number
          openai_key_enc?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asr_model?: string
          deepseek_key_enc?: string | null
          deepseek_model?: string
          id?: number
          openai_key_enc?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smm_posts: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          format: string
          goal: string
          id: string
          project_id: string
          publish_date: string | null
          rubric: string
          status: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          format?: string
          goal?: string
          id?: string
          project_id: string
          publish_date?: string | null
          rubric?: string
          status?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          format?: string
          goal?: string
          id?: string
          project_id?: string
          publish_date?: string | null
          rubric?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "smm_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          input: Json
          output: string
          project_id: string
          title: string
          tool: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          input?: Json
          output?: string
          project_id: string
          title?: string
          tool: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          input?: Json
          output?: string
          project_id?: string
          title?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_sample: boolean
          name: string
          project_id: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          name: string
          project_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          id: string
          project_id: string
          status: string
          template_id: string | null
          title: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          project_id: string
          status?: string
          template_id?: string | null
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          project_id?: string
          status?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      landings: {
        Row: {
          accent: string
          bullets: Json
          button_text: string
          created_at: string
          id: string
          pixel_id: string | null
          project_id: string
          logo: string | null
          questions: Json
          slug: string
          socials: Json
          start_button: string
          status: string
          subtitle: string
          thanks_text: string
          title: string
          type: string
        }
        Insert: {
          accent?: string
          bullets?: Json
          button_text?: string
          created_at?: string
          id?: string
          logo?: string | null
          pixel_id?: string | null
          project_id: string
          questions?: Json
          slug: string
          socials?: Json
          start_button?: string
          status?: string
          subtitle?: string
          thanks_text?: string
          title?: string
          type?: string
        }
        Update: {
          accent?: string
          bullets?: Json
          button_text?: string
          created_at?: string
          id?: string
          logo?: string | null
          pixel_id?: string | null
          project_id?: string
          questions?: Json
          slug?: string
          socials?: Json
          start_button?: string
          status?: string
          subtitle?: string
          thanks_text?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "landings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      capi_config: {
        Row: {
          connected_by: string | null
          created_at: string
          dataset_id: string
          last_error: string | null
          last_event_at: string | null
          project_id: string
          status: string
          test_event_code: string | null
          token_enc: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          dataset_id: string
          last_error?: string | null
          last_event_at?: string | null
          project_id: string
          status?: string
          test_event_code?: string | null
          token_enc: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          dataset_id?: string
          last_error?: string | null
          last_event_at?: string | null
          project_id?: string
          status?: string
          test_event_code?: string | null
          token_enc?: string
        }
        Relationships: []
      }
      capi_events: {
        Row: {
          created_at: string
          currency: string
          event_id: string
          event_name: string
          id: string
          lead_id: string | null
          project_id: string
          response: string | null
          sale_id: string | null
          status: string
          value: number
        }
        Insert: {
          created_at?: string
          currency?: string
          event_id: string
          event_name?: string
          id?: string
          lead_id?: string | null
          project_id: string
          response?: string | null
          sale_id?: string | null
          status?: string
          value?: number
        }
        Update: {
          created_at?: string
          currency?: string
          event_id?: string
          event_name?: string
          id?: string
          lead_id?: string | null
          project_id?: string
          response?: string | null
          sale_id?: string | null
          status?: string
          value?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          first_purchase_at: string | null
          full_name: string
          id: string
          phone: string | null
          project_id: string
          total_spent: number
        }
        Insert: {
          created_at?: string
          first_purchase_at?: string | null
          full_name: string
          id?: string
          phone?: string | null
          project_id: string
          total_spent?: number
        }
        Update: {
          created_at?: string
          first_purchase_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          project_id?: string
          total_spent?: number
        }
        Relationships: []
      }
      tg_sale_drafts: {
        Row: {
          amount: number | null
          chat_id: number
          lead_id: string | null
          lead_name: string | null
          project_id: string
          step: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          chat_id: number
          lead_id?: string | null
          lead_name?: string | null
          project_id: string
          step: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          chat_id?: number
          lead_id?: string | null
          lead_name?: string | null
          project_id?: string
          step?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trials: {
        Row: {
          assigned_to: string | null
          created_at: string
          full_name: string
          id: string
          lead_id: string | null
          phone: string | null
          project_id: string
          scheduled_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          full_name: string
          id?: string
          lead_id?: string | null
          phone?: string | null
          project_id: string
          scheduled_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          full_name?: string
          id?: string
          lead_id?: string | null
          phone?: string | null
          project_id?: string
          scheduled_at?: string | null
          status?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          project_id: string
          start_distance_m: number | null
          start_lat: number | null
          start_lng: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          project_id: string
          start_distance_m?: number | null
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          project_id?: string
          start_distance_m?: number | null
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          days: number[]
          end_time: string
          id: string
          project_id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          days?: number[]
          end_time?: string
          id?: string
          project_id: string
          start_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          days?: number[]
          end_time?: string
          id?: string
          project_id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          chat_id: number
          id: string
          linked_at: string
          project_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          id?: string
          linked_at?: string
          project_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          id?: string
          linked_at?: string
          project_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      report_targets: {
        Row: {
          chat_id: number
          created_at: string
          created_by: string | null
          enabled: boolean
          frequency: string
          id: string
          kind: string
          project_id: string
          title: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          frequency: string
          id?: string
          kind: string
          project_id: string
          title?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          frequency?: string
          id?: string
          kind?: string
          project_id?: string
          title?: string | null
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          project_id?: string
          user_id?: string
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
      can_manage_finance: { Args: { pid: string }; Returns: boolean }
      can_manage_ads: { Args: { pid: string }; Returns: boolean }
      create_employee: {
        Args: { p_project_id: string; p_full_name: string; p_role: string }
        Returns: Json
      }
      set_work_schedule: {
        Args: {
          p_project_id: string
          p_user_id: string
          p_days: number[]
          p_start: string
          p_end: string
        }
        Returns: undefined
      }
      gen_telegram_code: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: string
      }
      set_office: {
        Args: {
          p_project_id: string
          p_lat: number
          p_lng: number
          p_radius: number
          p_address: string
        }
        Returns: undefined
      }
      fire_member: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      set_usd_rate: {
        Args: { p_project_id: string; p_rate: number }
        Returns: undefined
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
