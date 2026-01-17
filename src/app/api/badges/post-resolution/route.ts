import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/badges/post-resolution
 *
 * Called after a market is resolved to check and award badges for all affected users.
 *
 * Body: { marketId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { marketId } = body

    if (!marketId) {
      return NextResponse.json({ error: 'marketId is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get the market with winning option
    const { data: market, error: marketError } = await supabaseAdmin
      .from('markets')
      .select(`
        id,
        resolved_at,
        market_options!inner (
          id,
          is_winner,
          total_pool
        )
      `)
      .eq('id', marketId)
      .eq('status', 'resolved')
      .single()

    if (marketError || !market) {
      return NextResponse.json({ error: 'Market not found or not resolved' }, { status: 404 })
    }

    // Get all bets for this market with user info
    const { data: bets, error: betsError } = await supabaseAdmin
      .from('bets')
      .select(`
        id,
        user_id,
        option_id,
        amount,
        odds_at_purchase,
        created_at,
        market_options!inner (
          id,
          is_winner,
          total_pool
        )
      `)
      .eq('market_options.market_id', marketId)

    if (betsError) {
      console.error('Error fetching bets:', betsError)
      return NextResponse.json({ error: 'Failed to fetch bets' }, { status: 500 })
    }

    if (!bets || bets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No bets to process',
        usersProcessed: 0,
        badgesAwarded: 0
      })
    }

    // Calculate total pool for the market
    const totalPool = market.market_options.reduce((sum: number, opt: any) => sum + (opt.total_pool || 0), 0)
    const winningOption = market.market_options.find((opt: any) => opt.is_winner)

    // Group bets by user to get full user context
    const userBets = new Map<string, any[]>()
    for (const bet of bets) {
      if (!userBets.has(bet.user_id)) {
        userBets.set(bet.user_id, [])
      }
      userBets.get(bet.user_id)!.push(bet)
    }

    // Get user balances before resolution (to check for all-in)
    const userIds = Array.from(userBets.keys())
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, credits')
      .in('id', userIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    let usersProcessed = 0
    let badgesAwarded = 0
    const results: any[] = []

    // Process each user's bets
    for (const [userId, userBetsList] of userBets) {
      const profile = profileMap.get(userId)

      for (const bet of userBetsList) {
        const option = bet.market_options
        const won = option.is_winner === true

        // Calculate hold duration
        const betDate = new Date(bet.created_at)
        const resolvedDate = new Date(market.resolved_at || Date.now())
        const holdDurationDays = Math.floor((resolvedDate.getTime() - betDate.getTime()) / (1000 * 60 * 60 * 24))

        // Check if was all-in (bet amount was close to user's balance before the bet)
        // We can't know exact balance before, so check if this bet is large relative to total
        const wasAllIn = bet.amount >= 500 && profile // Simplified check

        // Calculate pool percentage (what % of winning pool this user had)
        const poolPercentage = winningOption && option.id === winningOption.id && winningOption.total_pool > 0
          ? (bet.amount / winningOption.total_pool) * 100
          : 0

        // Update user stats for this resolution
        await supabaseAdmin.rpc('update_user_stats_on_resolution', {
          p_user_id: userId,
          p_won: won,
          p_bet_amount: bet.amount,
          p_was_all_in: wasAllIn || false,
          p_was_first_bettor: false // Can't easily determine this now
        })

        // Build context for badge checking
        const context = {
          won,
          bet_amount: bet.amount,
          all_in_win: wasAllIn && won,
          all_in_lose: wasAllIn && !won,
          hold_duration_days: holdDurationDays,
          probability_at_purchase: bet.odds_at_purchase || 0.5,
          pool_percentage: poolPercentage
        }

        // Check badges
        const { data: badgeResult, error: badgeError } = await supabaseAdmin.rpc('check_and_award_badges', {
          p_user_id: userId,
          p_bet_id: bet.id,
          p_context: context
        })

        if (!badgeError && badgeResult?.count > 0) {
          badgesAwarded += badgeResult.count
          results.push({
            userId,
            badges: badgeResult.newly_earned
          })
        }
      }

      usersProcessed++
    }

    return NextResponse.json({
      success: true,
      usersProcessed,
      badgesAwarded,
      results
    })

  } catch (error) {
    console.error('Error processing post-resolution badges:', error)
    return NextResponse.json({ error: 'Failed to process badges' }, { status: 500 })
  }
}
