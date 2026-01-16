export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MarketStatus = 'open' | 'closed' | 'resolved'
export type TransactionType = 'signup_bonus' | 'monthly_bonus' | 'bet_placed' | 'bet_won' | 'bet_refund'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string
          credits: number
          is_admin: boolean
          created_at: string
          last_credit_bonus_at: string | null
        }
        Insert: {
          id: string
          email: string
          display_name: string
          credits?: number
          is_admin?: boolean
          created_at?: string
          last_credit_bonus_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          credits?: number
          is_admin?: boolean
          created_at?: string
          last_credit_bonus_at?: string | null
        }
      }
      markets: {
        Row: {
          id: string
          title: string
          description: string
          category: string
          created_by: string
          status: MarketStatus
          closes_at: string
          resolved_at: string | null
          created_at: string
          total_bets: number
          unique_bettors: number
        }
        Insert: {
          id?: string
          title: string
          description: string
          category: string
          created_by: string
          status?: MarketStatus
          closes_at: string
          resolved_at?: string | null
          created_at?: string
          total_bets?: number
          unique_bettors?: number
        }
        Update: {
          id?: string
          title?: string
          description?: string
          category?: string
          created_by?: string
          status?: MarketStatus
          closes_at?: string
          resolved_at?: string | null
          created_at?: string
          total_bets?: number
          unique_bettors?: number
        }
      }
      market_options: {
        Row: {
          id: string
          market_id: string
          option_text: string
          is_winner: boolean | null
          created_at: string
          initial_probability: number
          current_probability: number
          total_pool: number
        }
        Insert: {
          id?: string
          market_id: string
          option_text: string
          is_winner?: boolean | null
          created_at?: string
          initial_probability?: number
          current_probability?: number
          total_pool?: number
        }
        Update: {
          id?: string
          market_id?: string
          option_text?: string
          is_winner?: boolean | null
          created_at?: string
          initial_probability?: number
          current_probability?: number
          total_pool?: number
        }
      }
      bets: {
        Row: {
          id: string
          user_id: string
          market_id: string
          option_id: string
          amount: number
          potential_payout: number
          odds_at_purchase: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          market_id: string
          option_id: string
          amount: number
          potential_payout: number
          odds_at_purchase: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          market_id?: string
          option_id?: string
          amount?: number
          potential_payout?: number
          odds_at_purchase?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: TransactionType
          reference_id: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: TransactionType
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: TransactionType
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      market_status: MarketStatus
      transaction_type: TransactionType
    }
  }
}

// Helper types for easier use
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Market = Database['public']['Tables']['markets']['Row']
export type MarketOption = Database['public']['Tables']['market_options']['Row']
export type Bet = Database['public']['Tables']['bets']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']

// Extended types with relations
export type MarketWithOptions = Market & {
  market_options: MarketOption[]
  profiles?: Pick<Profile, 'display_name'>
}

export type BetWithDetails = Bet & {
  markets: Market
  market_options: MarketOption
}
