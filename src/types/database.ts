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
      admin_actions: {
        Row: {
          action: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: Database["public"]["Enums"]["admin_action_type"]
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          ekyash_invoice_id: string | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          post_id: string
          role: Database["public"]["Enums"]["booking_role"]
          seats_booked: number | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          ekyash_invoice_id?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          post_id: string
          role: Database["public"]["Enums"]["booking_role"]
          seats_booked?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          ekyash_invoice_id?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          post_id?: string
          role?: Database["public"]["Enums"]["booking_role"]
          seats_booked?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "admin_posts_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          actor_id: string
          contract_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
        }
        Insert: {
          actor_id: string
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
        }
        Update: {
          actor_id?: string
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "contract_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_messages: {
        Row: {
          body: string
          contract_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          contract_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          contract_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_messages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "contract_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          agreed_price_cents: number
          booking_id: string
          completed_at: string | null
          created_at: string
          departure_at: string | null
          dest_address: string | null
          dest_coords: unknown
          id: string
          origin_address: string | null
          origin_coords: unknown
          parties: string[]
          post_id: string
          status: Database["public"]["Enums"]["contract_status"]
          terms: Json | null
        }
        Insert: {
          agreed_price_cents: number
          booking_id: string
          completed_at?: string | null
          created_at?: string
          departure_at?: string | null
          dest_address?: string | null
          dest_coords?: unknown
          id?: string
          origin_address?: string | null
          origin_coords?: unknown
          parties: string[]
          post_id: string
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json | null
        }
        Update: {
          agreed_price_cents?: number
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          departure_at?: string | null
          dest_address?: string | null
          dest_coords?: unknown
          id?: string
          origin_address?: string | null
          origin_coords?: unknown
          parties?: string[]
          post_id?: string
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "admin_posts_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_totals: {
        Row: {
          id: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          id?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          id?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_checkins: {
        Row: {
          contract_id: string
          created_at: string
          driver_id: string
          id: string
          lat: number | null
          lng: number | null
          selfie_url: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          driver_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          selfie_url: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          selfie_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_checkins_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_checkins_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "driver_checkins_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_checkins_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_details: {
        Row: {
          id: string
          id_document_url: string | null
          insurance_url: string | null
          license_url: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          taxi_association_id: string | null
          taxi_association_member_id: string | null
          taxi_association_name: string | null
          taxi_association_verified: boolean | null
          taxi_association_verified_at: string | null
          taxi_association_verified_by: string | null
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_year: number | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          id: string
          id_document_url?: string | null
          insurance_url?: string | null
          license_url?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          taxi_association_id?: string | null
          taxi_association_member_id?: string | null
          taxi_association_name?: string | null
          taxi_association_verified?: boolean | null
          taxi_association_verified_at?: string | null
          taxi_association_verified_by?: string | null
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          id?: string
          id_document_url?: string | null
          insurance_url?: string | null
          license_url?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          taxi_association_id?: string | null
          taxi_association_member_id?: string | null
          taxi_association_name?: string | null
          taxi_association_verified?: boolean | null
          taxi_association_verified_at?: string | null
          taxi_association_verified_by?: string | null
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "driver_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_details_taxi_association_id_fkey"
            columns: ["taxi_association_id"]
            isOneToOne: false
            referencedRelation: "taxi_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_details_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "driver_details_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_details_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: Database["public"]["Enums"]["driver_document_type"]
          document_url: string
          expiration_date: string | null
          id: string
          profile_id: string
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          uploaded_at: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type: Database["public"]["Enums"]["driver_document_type"]
          document_url: string
          expiration_date?: string | null
          id?: string
          profile_id: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          uploaded_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["driver_document_type"]
          document_url?: string
          expiration_date?: string | null
          id?: string
          profile_id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "driver_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "driver_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ekyash_transactions: {
        Row: {
          amount_cents: number
          callback_payload: Json | null
          callback_received: boolean | null
          contract_id: string
          created_at: string
          currency: string
          donation_cents: number
          id: string
          invoice_id: string | null
          order_id: string
          payee_id: string
          payer_id: string
          platform_fee_cents: number
          refunded_amount_cents: number
          status: Database["public"]["Enums"]["ekyash_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          callback_payload?: Json | null
          callback_received?: boolean | null
          contract_id: string
          created_at?: string
          currency?: string
          donation_cents?: number
          id?: string
          invoice_id?: string | null
          order_id: string
          payee_id: string
          payer_id: string
          platform_fee_cents?: number
          refunded_amount_cents?: number
          status?: Database["public"]["Enums"]["ekyash_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          callback_payload?: Json | null
          callback_received?: boolean | null
          contract_id?: string
          created_at?: string
          currency?: string
          donation_cents?: number
          id?: string
          invoice_id?: string | null
          order_id?: string
          payee_id?: string
          payer_id?: string
          platform_fee_cents?: number
          refunded_amount_cents?: number
          status?: Database["public"]["Enums"]["ekyash_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ekyash_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ekyash_transactions_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "ekyash_transactions_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ekyash_transactions_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ekyash_transactions_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "ekyash_transactions_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ekyash_transactions_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_receipts: {
        Row: {
          contract_id: string | null
          ekyash_txn_id: string | null
          email_to: string
          error: string | null
          id: string
          resend_id: string | null
          sent_at: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          contract_id?: string | null
          ekyash_txn_id?: string | null
          email_to: string
          error?: string | null
          id?: string
          resend_id?: string | null
          sent_at?: string
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          contract_id?: string | null
          ekyash_txn_id?: string | null
          email_to?: string
          error?: string | null
          id?: string
          resend_id?: string | null
          sent_at?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_receipts_ekyash_txn_id_fkey"
            columns: ["ekyash_txn_id"]
            isOneToOne: false
            referencedRelation: "admin_transactions_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_receipts_ekyash_txn_id_fkey"
            columns: ["ekyash_txn_id"]
            isOneToOne: false
            referencedRelation: "ekyash_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "email_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: Database["public"]["Enums"]["flag_reason"]
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["flag_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["flag_target"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: Database["public"]["Enums"]["flag_reason"]
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["flag_target"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["flag_reason"]
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["flag_target"]
        }
        Relationships: [
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      gas_price_verifications: {
        Row: {
          created_at: string
          price_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          price_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          price_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gas_price_verifications_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "gas_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      gas_prices: {
        Row: {
          diesel_cents: number | null
          id: string
          premium_cents: number | null
          regular_cents: number | null
          reported_at: string
          reporter_id: string
          station_lat: number
          station_lng: number
          station_name: string
          verified_count: number | null
        }
        Insert: {
          diesel_cents?: number | null
          id?: string
          premium_cents?: number | null
          regular_cents?: number | null
          reported_at?: string
          reporter_id: string
          station_lat: number
          station_lng: number
          station_name: string
          verified_count?: number | null
        }
        Update: {
          diesel_cents?: number | null
          id?: string
          premium_cents?: number | null
          regular_cents?: number | null
          reported_at?: string
          reporter_id?: string
          station_lat?: number
          station_lng?: number
          station_name?: string
          verified_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gas_prices_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "gas_prices_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_prices_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
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
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          created_at: string
          departure_at: string | null
          description: string | null
          dest_address: string | null
          dest_lat: number | null
          dest_lng: number | null
          errand_category: Database["public"]["Enums"]["errand_category"] | null
          errand_fee_cents: number | null
          expires_at: string | null
          id: string
          is_round_trip: boolean
          item_cost_cents: number | null
          job_category: Database["public"]["Enums"]["job_category"] | null
          job_timeline: Database["public"]["Enums"]["job_timeline"] | null
          last_confirmed_at: string | null
          min_riders: number | null
          origin_address: string | null
          origin_lat: number | null
          origin_lng: number | null
          pay_rate_cents: number | null
          pay_type: Database["public"]["Enums"]["pay_type"] | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_notes: string | null
          pickup_style: Database["public"]["Enums"]["pickup_style"] | null
          price_cents: number | null
          repeat_days: number[] | null
          repeat_until: string | null
          return_time: string | null
          route_distance_km: number | null
          route_duration_min: number | null
          route_fuel_cost_cents: number | null
          route_geometry: Json | null
          seats_filled: number | null
          seats_total: number | null
          status: Database["public"]["Enums"]["post_status"]
          title: string
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          vehicle_description: string | null
        }
        Insert: {
          author_id: string
          created_at?: string
          departure_at?: string | null
          description?: string | null
          dest_address?: string | null
          dest_lat?: number | null
          dest_lng?: number | null
          errand_category?:
            | Database["public"]["Enums"]["errand_category"]
            | null
          errand_fee_cents?: number | null
          expires_at?: string | null
          id?: string
          is_round_trip?: boolean
          item_cost_cents?: number | null
          job_category?: Database["public"]["Enums"]["job_category"] | null
          job_timeline?: Database["public"]["Enums"]["job_timeline"] | null
          last_confirmed_at?: string | null
          min_riders?: number | null
          origin_address?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          pay_rate_cents?: number | null
          pay_type?: Database["public"]["Enums"]["pay_type"] | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_notes?: string | null
          pickup_style?: Database["public"]["Enums"]["pickup_style"] | null
          price_cents?: number | null
          repeat_days?: number[] | null
          repeat_until?: string | null
          return_time?: string | null
          route_distance_km?: number | null
          route_duration_min?: number | null
          route_fuel_cost_cents?: number | null
          route_geometry?: Json | null
          seats_filled?: number | null
          seats_total?: number | null
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          type: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          vehicle_description?: string | null
        }
        Update: {
          author_id?: string
          created_at?: string
          departure_at?: string | null
          description?: string | null
          dest_address?: string | null
          dest_lat?: number | null
          dest_lng?: number | null
          errand_category?:
            | Database["public"]["Enums"]["errand_category"]
            | null
          errand_fee_cents?: number | null
          expires_at?: string | null
          id?: string
          is_round_trip?: boolean
          item_cost_cents?: number | null
          job_category?: Database["public"]["Enums"]["job_category"] | null
          job_timeline?: Database["public"]["Enums"]["job_timeline"] | null
          last_confirmed_at?: string | null
          min_riders?: number | null
          origin_address?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          pay_rate_cents?: number | null
          pay_type?: Database["public"]["Enums"]["pay_type"] | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_notes?: string | null
          pickup_style?: Database["public"]["Enums"]["pickup_style"] | null
          price_cents?: number | null
          repeat_days?: number[] | null
          repeat_until?: string | null
          return_time?: string | null
          route_distance_km?: number | null
          route_duration_min?: number | null
          route_fuel_cost_cents?: number | null
          route_geometry?: Json | null
          seats_filled?: number | null
          seats_total?: number | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          vehicle_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          address_line: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          district: Database["public"]["Enums"]["belize_district"] | null
          email: string | null
          emergency_contact: string | null
          first_name: string | null
          id: string
          last_active_at: string | null
          last_name: string | null
          notification_preferences: Json
          phone: string | null
          phone_changed_at: string | null
          punctuality_pct: number | null
          push_token: string | null
          rating_avg: number | null
          role: Database["public"]["Enums"]["role"]
          strikes_hard: number | null
          strikes_soft: number | null
          taxi_association_name: string | null
          taxi_association_verified: boolean | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          address_line?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          district?: Database["public"]["Enums"]["belize_district"] | null
          email?: string | null
          emergency_contact?: string | null
          first_name?: string | null
          id: string
          last_active_at?: string | null
          last_name?: string | null
          notification_preferences?: Json
          phone?: string | null
          phone_changed_at?: string | null
          punctuality_pct?: number | null
          push_token?: string | null
          rating_avg?: number | null
          role?: Database["public"]["Enums"]["role"]
          strikes_hard?: number | null
          strikes_soft?: number | null
          taxi_association_name?: string | null
          taxi_association_verified?: boolean | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          address_line?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          district?: Database["public"]["Enums"]["belize_district"] | null
          email?: string | null
          emergency_contact?: string | null
          first_name?: string | null
          id?: string
          last_active_at?: string | null
          last_name?: string | null
          notification_preferences?: Json
          phone?: string | null
          phone_changed_at?: string | null
          punctuality_pct?: number | null
          push_token?: string | null
          rating_avg?: number | null
          role?: Database["public"]["Enums"]["role"]
          strikes_hard?: number | null
          strikes_soft?: number | null
          taxi_association_name?: string | null
          taxi_association_verified?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          contract_id: string
          created_at: string
          id: string
          is_anonymous: boolean
          rated_id: string
          rater_id: string
          stars: number
          was_on_time: boolean | null
        }
        Insert: {
          comment?: string | null
          contract_id: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          rated_id: string
          rater_id: string
          stars: number
          was_on_time?: boolean | null
        }
        Update: {
          comment?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          rated_id?: string
          rater_id?: string
          stars?: number
          was_on_time?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_documents: {
        Row: {
          document_url: string
          id: string
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_by: string | null
          uploaded_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          document_url: string
          id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_by?: string | null
          uploaded_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          document_url?: string
          id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_by?: string | null
          uploaded_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "rider_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "rider_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      strikes: {
        Row: {
          auto_generated: boolean | null
          contract_id: string | null
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["strike_reason"]
          type: Database["public"]["Enums"]["strike_type"]
          user_id: string
        }
        Insert: {
          auto_generated?: boolean | null
          contract_id?: string | null
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["strike_reason"]
          type: Database["public"]["Enums"]["strike_type"]
          user_id: string
        }
        Update: {
          auto_generated?: boolean | null
          contract_id?: string | null
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["strike_reason"]
          type?: Database["public"]["Enums"]["strike_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strikes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      taxi_associations: {
        Row: {
          address: string | null
          created_at: string
          district: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          district: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          district?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_dashboard_stats: {
        Row: {
          active_posts: number | null
          completed_contracts: number | null
          pending_drivers: number | null
          pending_flags: number | null
          pending_rider_docs: number | null
          total_users: number | null
        }
        Relationships: []
      }
      admin_drivers_list: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          created_at: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_year: number | null
          verified: boolean | null
          verified_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "driver_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_flag_detail: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          reason: Database["public"]["Enums"]["flag_reason"] | null
          reporter_first_name: string | null
          reporter_id: string | null
          reporter_last_name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["flag_status"] | null
          target_id: string | null
          target_post_author_first_name: string | null
          target_post_author_id: string | null
          target_post_author_last_name: string | null
          target_post_status: Database["public"]["Enums"]["post_status"] | null
          target_post_title: string | null
          target_post_type: Database["public"]["Enums"]["post_type"] | null
          target_type: Database["public"]["Enums"]["flag_target"] | null
          target_user_account_status:
            | Database["public"]["Enums"]["account_status"]
            | null
          target_user_first_name: string | null
          target_user_last_name: string | null
          target_user_role: Database["public"]["Enums"]["role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_flags_list: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          reason: Database["public"]["Enums"]["flag_reason"] | null
          reporter_first_name: string | null
          reporter_last_name: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["flag_status"] | null
          target_id: string | null
          target_type: Database["public"]["Enums"]["flag_target"] | null
        }
        Relationships: []
      }
      admin_posts_list: {
        Row: {
          author_first_name: string | null
          author_last_name: string | null
          created_at: string | null
          departure_at: string | null
          id: string | null
          price_cents: number | null
          seats_filled: number | null
          seats_total: number | null
          status: Database["public"]["Enums"]["post_status"] | null
          title: string | null
          type: Database["public"]["Enums"]["post_type"] | null
        }
        Relationships: []
      }
      admin_recent_actions: {
        Row: {
          action: Database["public"]["Enums"]["admin_action_type"] | null
          admin_first_name: string | null
          admin_last_name: string | null
          created_at: string | null
          id: string | null
          metadata: Json | null
          reason: string | null
          target_id: string | null
          target_type: string | null
        }
        Relationships: []
      }
      admin_rider_docs_list: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          document_url: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          uploaded_at: string | null
          user_id: string | null
          verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "rider_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_transactions_list: {
        Row: {
          amount_cents: number | null
          contract_id: string | null
          created_at: string | null
          currency: string | null
          donation_cents: number | null
          id: string | null
          invoice_id: string | null
          order_id: string | null
          payee_first_name: string | null
          payee_last_name: string | null
          payer_first_name: string | null
          payer_last_name: string | null
          platform_fee_cents: number | null
          status: Database["public"]["Enums"]["ekyash_status"] | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ekyash_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          address_line: string | null
          avatar_url: string | null
          created_at: string | null
          district: Database["public"]["Enums"]["belize_district"] | null
          first_name: string | null
          id: string | null
          last_active_at: string | null
          last_name: string | null
          punctuality_pct: number | null
          rating_avg: number | null
          role: Database["public"]["Enums"]["role"] | null
          taxi_association_name: string | null
          taxi_association_verified: boolean | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          address_line?: string | null
          avatar_url?: string | null
          created_at?: string | null
          district?: Database["public"]["Enums"]["belize_district"] | null
          first_name?: string | null
          id?: string | null
          last_active_at?: string | null
          last_name?: string | null
          punctuality_pct?: number | null
          rating_avg?: number | null
          role?: Database["public"]["Enums"]["role"] | null
          taxi_association_name?: string | null
          taxi_association_verified?: boolean | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          address_line?: string | null
          avatar_url?: string | null
          created_at?: string | null
          district?: Database["public"]["Enums"]["belize_district"] | null
          first_name?: string | null
          id?: string | null
          last_active_at?: string | null
          last_name?: string | null
          punctuality_pct?: number | null
          rating_avg?: number | null
          role?: Database["public"]["Enums"]["role"] | null
          taxi_association_name?: string | null
          taxi_association_verified?: boolean | null
        }
        Relationships: []
      }
      ratings_public: {
        Row: {
          comment: string | null
          contract_id: string | null
          created_at: string | null
          id: string | null
          is_anonymous: boolean | null
          rated_id: string | null
          rater_avatar_url: string | null
          rater_first_name: string | null
          rater_id: string | null
          rater_last_name: string | null
          rater_role: Database["public"]["Enums"]["role"] | null
          stars: number | null
          was_on_time: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "admin_flag_detail"
            referencedColumns: ["target_post_author_id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _admin_check: { Args: { p_admin_id: string }; Returns: undefined }
      accept_applicant: { Args: { p_booking_id: string }; Returns: undefined }
      accept_job_application: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      admin_moderate_flag: {
        Args: {
          p_action: string
          p_admin_id?: string
          p_flag_id: string
          p_reason?: string
        }
        Returns: string
      }
      admin_review_driver: {
        Args: {
          p_action: string
          p_admin_id?: string
          p_driver_id: string
          p_reason?: string
        }
        Returns: string
      }
      admin_review_rider_doc: {
        Args: {
          p_action: string
          p_admin_id?: string
          p_doc_id: string
          p_reason?: string
        }
        Returns: string
      }
      admin_user_action: {
        Args: {
          p_action: string
          p_admin_id?: string
          p_reason?: string
          p_user_id: string
        }
        Returns: string
      }
      cancel_route_short: {
        Args: { p_post_id: string; p_reason?: string }
        Returns: undefined
      }
      check_driver_documents_complete: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      check_user_availability: {
        Args: { p_at: string; p_duration_min: number; p_user_id: string }
        Returns: {
          contract_id: string
          departure_at: string
          post_id: string
          post_title: string
          post_type: Database["public"]["Enums"]["post_type"]
        }[]
      }
      compute_rating_avg: { Args: { p_user_id: string }; Returns: Json }
      confirm_recurring_route: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      is_active_account: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      proceed_route: { Args: { p_post_id: string }; Returns: undefined }
      process_ekyash_payment: {
        Args: {
          p_callback_payload: Json
          p_order_id: string
          p_transaction_id: string
        }
        Returns: Json
      }
      reactivate_account: { Args: never; Returns: undefined }
      reject_applicant: { Args: { p_booking_id: string }; Returns: undefined }
      reject_job_application: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      set_initial_role: { Args: { p_role: string }; Returns: undefined }
      switch_to_driver_role: { Args: { p_user_id: string }; Returns: undefined }
      switch_to_rider_role: { Args: { p_user_id: string }; Returns: undefined }
      verify_gas_price: {
        Args: { price_id: string }
        Returns: {
          diesel_cents: number | null
          id: string
          premium_cents: number | null
          regular_cents: number | null
          reported_at: string
          reporter_id: string
          station_lat: number
          station_lng: number
          station_name: string
          verified_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "gas_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_status:
        | "pending"
        | "active"
        | "restricted"
        | "suspended"
        | "dormant"
        | "suspended_pending_deletion"
      admin_action_type:
        | "approve_driver"
        | "reject_driver"
        | "approve_rider_doc"
        | "reject_rider_doc"
        | "suspend_user"
        | "unsuspend_user"
        | "remove_post"
        | "dismiss_flag"
        | "issue_strike"
        | "invite_admin"
      belize_district:
        | "belize"
        | "cayo"
        | "corozal"
        | "orange_walk"
        | "stann_creek"
        | "toledo"
      booking_role: "rider" | "driver"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "no_show"
        | "completed"
        | "rejected"
      contract_status: "active" | "completed" | "disputed" | "cancelled"
      driver_document_type:
        | "drivers_license"
        | "vehicle_insurance"
        | "vehicle_registration"
        | "police_record"
        | "taxi_association_card"
      ekyash_status:
        | "pending"
        | "approved"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      errand_category:
        | "grocery"
        | "bill"
        | "pharmacy"
        | "document"
        | "delivery"
        | "food"
        | "hardware"
        | "other"
      flag_reason:
        | "spam"
        | "scam"
        | "harassment"
        | "fake_account"
        | "safety"
        | "other"
      flag_status: "pending" | "reviewed" | "action_taken" | "dismissed"
      flag_target: "post" | "user" | "booking"
      job_category:
        | "skilled_trade"
        | "cleaning"
        | "delivery"
        | "handyman"
        | "landscaping"
        | "moving"
        | "tutoring"
        | "tech"
        | "other"
      job_timeline: "asap" | "today" | "this_week" | "flexible"
      pay_type: "hourly" | "fixed"
      payment_method: "cash" | "ekyash"
      pickup_style: "single" | "multi_stop"
      post_status:
        | "open"
        | "activated"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "expired"
        | "filled"
      post_type: "route_offer" | "route_request" | "errand" | "package" | "job"
      review_status: "pending" | "approved" | "rejected"
      role: "rider" | "driver" | "admin"
      strike_reason:
        | "late_cancel"
        | "no_show"
        | "early_leave"
        | "driver_no_show"
        | "report"
      strike_type: "soft" | "hard"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: [
        "pending",
        "active",
        "restricted",
        "suspended",
        "dormant",
        "suspended_pending_deletion",
      ],
      admin_action_type: [
        "approve_driver",
        "reject_driver",
        "approve_rider_doc",
        "reject_rider_doc",
        "suspend_user",
        "unsuspend_user",
        "remove_post",
        "dismiss_flag",
        "issue_strike",
        "invite_admin",
      ],
      belize_district: [
        "belize",
        "cayo",
        "corozal",
        "orange_walk",
        "stann_creek",
        "toledo",
      ],
      booking_role: ["rider", "driver"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "no_show",
        "completed",
        "rejected",
      ],
      contract_status: ["active", "completed", "disputed", "cancelled"],
      driver_document_type: [
        "drivers_license",
        "vehicle_insurance",
        "vehicle_registration",
        "police_record",
        "taxi_association_card",
      ],
      ekyash_status: [
        "pending",
        "approved",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      errand_category: [
        "grocery",
        "bill",
        "pharmacy",
        "document",
        "delivery",
        "food",
        "hardware",
        "other",
      ],
      flag_reason: [
        "spam",
        "scam",
        "harassment",
        "fake_account",
        "safety",
        "other",
      ],
      flag_status: ["pending", "reviewed", "action_taken", "dismissed"],
      flag_target: ["post", "user", "booking"],
      job_category: [
        "skilled_trade",
        "cleaning",
        "delivery",
        "handyman",
        "landscaping",
        "moving",
        "tutoring",
        "tech",
        "other",
      ],
      job_timeline: ["asap", "today", "this_week", "flexible"],
      pay_type: ["hourly", "fixed"],
      payment_method: ["cash", "ekyash"],
      pickup_style: ["single", "multi_stop"],
      post_status: [
        "open",
        "activated",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
        "filled",
      ],
      post_type: ["route_offer", "route_request", "errand", "package", "job"],
      review_status: ["pending", "approved", "rejected"],
      role: ["rider", "driver", "admin"],
      strike_reason: [
        "late_cancel",
        "no_show",
        "early_leave",
        "driver_no_show",
        "report",
      ],
      strike_type: ["soft", "hard"],
    },
  },
} as const

export type AccountStatus = Enums<'account_status'>
export type BelizeDistrict = Enums<'belize_district'>
export type BookingStatus = Enums<'booking_status'>
export type ContractStatus = Enums<'contract_status'>
export type DriverDocumentType = Enums<'driver_document_type'>
export type ErrandCategory = Enums<'errand_category'>
export type FlagReason = Enums<'flag_reason'>
export type JobCategory = Enums<'job_category'>
export type JobTimeline = Enums<'job_timeline'>
export type PayType = Enums<'pay_type'>
export type PaymentMethod = Enums<'payment_method'>
export type PickupStyle = Enums<'pickup_style'>
export type PostStatus = Enums<'post_status'>
export type PostType = Enums<'post_type'>
export type ReviewStatus = Enums<'review_status'>
export type Role = Enums<'role'>
