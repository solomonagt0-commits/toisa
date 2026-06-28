export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      toisa_tenders: {
        Row: {
          id: string
          source_portal: string
          tender_number: string | null
          title: string
          description: string | null
          url: string | null
          category: string | null
          location: string | null
          closing_date: string | null
          estimated_value: number | null
          status: string
          relevance_score: number
          raw_data: Json | null
          discovered_at: string
          created_at: string
        }
        Insert: {
          id?: string
          source_portal: string
          tender_number?: string | null
          title: string
          description?: string | null
          url?: string | null
          category?: string | null
          location?: string | null
          closing_date?: string | null
          estimated_value?: number | null
          status?: string
          relevance_score?: number
          raw_data?: Json | null
          discovered_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          source_portal?: string
          tender_number?: string | null
          title?: string
          description?: string | null
          url?: string | null
          category?: string | null
          location?: string | null
          closing_date?: string | null
          estimated_value?: number | null
          status?: string
          relevance_score?: number
          raw_data?: Json | null
          discovered_at?: string
          created_at?: string
        }
      }
      toisa_pipeline_items: {
        Row: {
          id: string
          tender_id: string | null
          subject: string
          sender: string | null
          body: string | null
          stage: string
          deadline: string | null
          notes: string | null
          source: string
          won_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tender_id?: string | null
          subject: string
          sender?: string | null
          body?: string | null
          stage?: string
          deadline?: string | null
          notes?: string | null
          source?: string
          won_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tender_id?: string | null
          subject?: string
          sender?: string | null
          body?: string | null
          stage?: string
          deadline?: string | null
          notes?: string | null
          source?: string
          won_amount?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      toisa_compliance_documents: {
        Row: {
          id: string
          document_type: string
          name: string
          file_url: string | null
          issue_date: string | null
          expiry_date: string | null
          status: string
          alert_30d: boolean
          alert_14d: boolean
          alert_7d: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_type: string
          name: string
          file_url?: string | null
          issue_date?: string | null
          expiry_date?: string | null
          status?: string
          alert_30d?: boolean
          alert_14d?: boolean
          alert_7d?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_type?: string
          name?: string
          file_url?: string | null
          issue_date?: string | null
          expiry_date?: string | null
          status?: string
          alert_30d?: boolean
          alert_14d?: boolean
          alert_7d?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      toisa_user_profile: {
        Row: {
          id: string
          full_name: string | null
          company_name: string
          email: string | null
          bbee_level: number
          cidb_grade: number
          service_categories: string[]
          provinces: string[]
          preferred_alerts: string
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          company_name?: string
          email?: string | null
          bbee_level?: number
          cidb_grade?: number
          service_categories?: string[]
          provinces?: string[]
          preferred_alerts?: string
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          company_name?: string
          email?: string | null
          bbee_level?: number
          cidb_grade?: number
          service_categories?: string[]
          provinces?: string[]
          preferred_alerts?: string
          created_at?: string
        }
      }
    }
  }
}

export type Tender = Database['public']['Tables']['toisa_tenders']['Row']
export type PipelineItem = Database['public']['Tables']['toisa_pipeline_items']['Row']
export type ComplianceDocument = Database['public']['Tables']['toisa_compliance_documents']['Row']
export type UserProfile = Database['public']['Tables']['toisa_user_profile']['Row']
