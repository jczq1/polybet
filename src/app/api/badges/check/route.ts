import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/badges/check
 *
 * Called after bet placement or resolution to update stats and check badges.
 *
 * For bet placement:
 * {
 *   event: 'bet_placed',
 *   userId: string,
 *   betAmount: number,
 *   userBalanceBefore: number, // to check if all-in
 *   marketId: string,
 *   isFirstBettor: boolean
 * }
 *
 * For bet resolution:
 * {
 *   event: 'bet_resolved',
 *   userId: string,
 *   won: boolean,
 *   betAmount: number,
 *   wasAllIn: boolean,
 *   holdDurationDays: number,
 *   probabilityAtPurchase: number, // 0-1
 *   poolPercentage: number, // percentage of pool user's side had
 * }
 *
 * For leaderboard update:
 * {
 *   event: 'leaderboard_update',
 *   userId: string,
 *   rank: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, userId } = body

    if (!event || !userId) {
      return NextResponse.json({ error: 'event and userId are required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let context: Record<string, any> = {}
    let newBadges: any = { newly_earned: [], count: 0 }

    switch (event) {
      case 'bet_placed': {
        const { betAmount, userBalanceBefore, isFirstBettor } = body

        // Check if this was an all-in bet (for later when it resolves)
        const wasAllIn = userBalanceBefore > 0 && betAmount >= userBalanceBefore * 0.99 // 99% to account for rounding

        // Update user stats for bet placed
        await supabaseAdmin.rpc('update_user_stats_on_bet_placed', {
          p_user_id: userId,
          p_bet_amount: betAmount,
          p_is_first_bettor: isFirstBettor || false
        })

        // Check badges (for total_bets, single_bet_amount, first_bettor_count)
        const { data } = await supabaseAdmin.rpc('check_and_award_badges', {
          p_user_id: userId,
          p_bet_id: null,
          p_context: { bet_amount: betAmount }
        })
        newBadges = data

        return NextResponse.json({
          success: true,
          wasAllIn,
          newBadges
        })
      }

      case 'bet_resolved': {
        const {
          won,
          betAmount,
          wasAllIn,
          holdDurationDays,
          probabilityAtPurchase,
          poolPercentage
        } = body

        // Update user stats for resolution
        await supabaseAdmin.rpc('update_user_stats_on_resolution', {
          p_user_id: userId,
          p_won: won,
          p_bet_amount: betAmount,
          p_was_all_in: wasAllIn || false,
          p_was_first_bettor: false
        })

        // Build context for badge checking
        context = {
          won,
          bet_amount: betAmount,
          all_in_win: wasAllIn && won,
          all_in_lose: wasAllIn && !won,
          hold_duration_days: holdDurationDays || 0,
          probability_at_purchase: probabilityAtPurchase || 0.5,
          pool_percentage: poolPercentage || 50
        }

        // Check all badges
        const { data } = await supabaseAdmin.rpc('check_and_award_badges', {
          p_user_id: userId,
          p_bet_id: null,
          p_context: context
        })
        newBadges = data

        return NextResponse.json({
          success: true,
          newBadges
        })
      }

      case 'leaderboard_update': {
        const { rank } = body

        if (typeof rank !== 'number') {
          return NextResponse.json({ error: 'rank is required' }, { status: 400 })
        }

        // Update leaderboard rank tracking
        await supabaseAdmin.rpc('update_leaderboard_rank', {
          p_user_id: userId,
          p_rank: rank
        })

        // Check badges (for leaderboard_rank)
        const { data } = await supabaseAdmin.rpc('check_and_award_badges', {
          p_user_id: userId,
          p_bet_id: null,
          p_context: { leaderboard_rank: rank }
        })
        newBadges = data

        return NextResponse.json({
          success: true,
          newBadges
        })
      }

      default:
        return NextResponse.json({ error: `Unknown event type: ${event}` }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing badge check:', error)
    return NextResponse.json({ error: 'Failed to process badge check' }, { status: 500 })
  }
}
