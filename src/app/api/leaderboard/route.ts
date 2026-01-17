import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use service role to bypass RLS and get consistent data for all users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get all profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, credits, created_at')

    // Get all displayed badges for all users
    const { data: displayedBadges } = await supabaseAdmin
      .from('user_badges')
      .select(`
        user_id,
        display_order,
        badges (id, name, icon, description)
      `)
      .not('display_order', 'is', null)
      .order('display_order', { ascending: true })

    // Group badges by user
    const userBadges: Record<string, Array<{ id: string; name: string; icon: string; description: string }>> = {}
    displayedBadges?.forEach((ub: any) => {
      if (!userBadges[ub.user_id]) {
        userBadges[ub.user_id] = []
      }
      if (ub.badges) {
        userBadges[ub.user_id].push({
          id: ub.badges.id,
          name: ub.badges.name,
          icon: ub.badges.icon,
          description: ub.badges.description
        })
      }
    })

    // Get all bets with market status
    const { data: allBets } = await supabaseAdmin
      .from('bets')
      .select(`
        user_id,
        amount,
        market_id,
        created_at,
        markets!inner (status)
      `)

    // Get all transactions
    const { data: allTransactions } = await supabaseAdmin
      .from('transactions')
      .select('user_id, amount, type, created_at')

    // Calculate 30 days ago timestamp
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

    // Calculate data per user
    const unresolvedBetAmounts: Record<string, number> = {}
    const betCounts: Record<string, number> = {}
    const signupBonuses: Record<string, number> = {}
    const totalMonthlyBonuses: Record<string, number> = {}
    const monthlyBonusesLast30Days: Record<string, number> = {}
    const unresolvedBets30DaysAgo: Record<string, number> = {}
    const credits30DaysAgo: Record<string, number> = {}

    // Process transactions
    // Track signup bonus timestamps to only use the first one per user (avoid duplicates)
    const signupBonusTimestamps: Record<string, string> = {}

    allTransactions?.forEach((tx: { user_id: string; amount: number; type: string; created_at: string }) => {
      if (tx.type === 'signup_bonus') {
        // Only use ONE signup bonus per user (the first/earliest one)
        // This prevents double-counting if there are duplicate transactions
        if (!signupBonusTimestamps[tx.user_id] || tx.created_at < signupBonusTimestamps[tx.user_id]) {
          signupBonuses[tx.user_id] = tx.amount
          signupBonusTimestamps[tx.user_id] = tx.created_at
        }
      }
      if (tx.type === 'monthly_bonus') {
        // Total monthly bonuses (for lifetime ROI)
        totalMonthlyBonuses[tx.user_id] = (totalMonthlyBonuses[tx.user_id] || 0) + tx.amount

        // Monthly bonuses received in past 30 days (for 30-day ROI)
        if (tx.created_at >= thirtyDaysAgoStr) {
          monthlyBonusesLast30Days[tx.user_id] = (monthlyBonusesLast30Days[tx.user_id] || 0) + tx.amount
        }
      }
    })

    // Process bets
    allBets?.forEach((bet: any) => {
      betCounts[bet.user_id] = (betCounts[bet.user_id] || 0) + 1

      // Get market status (handle both array and object cases from Supabase)
      const marketStatus = Array.isArray(bet.markets) ? bet.markets[0]?.status : bet.markets?.status

      // Current unresolved bets
      if (marketStatus !== 'resolved') {
        unresolvedBetAmounts[bet.user_id] = (unresolvedBetAmounts[bet.user_id] || 0) + bet.amount

        // Bets that were in unresolved markets 30 days ago
        // (bets placed before 30 days ago that are STILL unresolved)
        if (bet.created_at < thirtyDaysAgoStr) {
          unresolvedBets30DaysAgo[bet.user_id] = (unresolvedBets30DaysAgo[bet.user_id] || 0) + bet.amount
        }
      }
    })

    // Calculate credits 30 days ago by working backwards from transactions
    profiles?.forEach((profile: { id: string; credits: number; created_at: string }) => {
      let credits30d = profile.credits

      allTransactions?.forEach((tx: { user_id: string; amount: number; created_at: string }) => {
        if (tx.user_id === profile.id && tx.created_at >= thirtyDaysAgoStr) {
          // Subtract transactions from last 30 days to get balance 30 days ago
          credits30d -= tx.amount
        }
      })

      credits30DaysAgo[profile.id] = Math.max(0, credits30d)
    })

    // Calculate ROI for each user
    const DEFAULT_INITIAL_CREDITS = 1000

    const leaderboardData = (profiles || []).map((profile: { id: string; display_name: string; credits: number; created_at: string }) => {
      const currentCredits = profile.credits
      const currentUnresolvedBets = unresolvedBetAmounts[profile.id] || 0
      const currentTotalValue = currentCredits + currentUnresolvedBets

      const startingBalance = signupBonuses[profile.id] || DEFAULT_INITIAL_CREDITS
      const allMonthlyRewards = totalMonthlyBonuses[profile.id] || 0

      // ============================================
      // LIFETIME ROI
      // ============================================
      // Net change = (current balance + unresolved bets) - (starting balance + all monthly rewards)
      // Initial = starting balance + all monthly rewards
      // ROI = net change / initial * 100%
      const lifetimeInitial = startingBalance + allMonthlyRewards
      const lifetimeNetChange = currentTotalValue - lifetimeInitial
      const lifetimeRoi = lifetimeInitial > 0
        ? (lifetimeNetChange / lifetimeInitial) * 100
        : 0

      // ============================================
      // 30-DAY ROI
      // ============================================
      // Check if user was created in the past 30 days
      const userCreatedAt = new Date(profile.created_at)
      const wasCreatedWithin30Days = profile.created_at >= thirtyDaysAgoStr

      let roi30Day: number

      if (wasCreatedWithin30Days) {
        // User created within past 30 days: 30-day ROI equals lifetime ROI
        roi30Day = lifetimeRoi
      } else {
        // User existed 30 days ago
        // Initial = (balance 30 days ago) + (unresolved bets 30 days ago) + (monthly rewards in past 30 days)
        const balance30DaysAgo = credits30DaysAgo[profile.id] || 0
        const unresolvedBetsValue30DaysAgo = unresolvedBets30DaysAgo[profile.id] || 0
        const monthlyRewardsLast30Days = monthlyBonusesLast30Days[profile.id] || 0

        const initial30Day = balance30DaysAgo + unresolvedBetsValue30DaysAgo + monthlyRewardsLast30Days
        const netChange30Day = currentTotalValue - initial30Day

        roi30Day = initial30Day > 0
          ? (netChange30Day / initial30Day) * 100
          : 0
      }

      return {
        id: profile.id,
        display_name: profile.display_name,
        credits: profile.credits,
        unresolved_bets: currentUnresolvedBets,
        roi_30day: roi30Day,
        roi_lifetime: lifetimeRoi,
        total_bets: betCounts[profile.id] || 0,
        displayed_badges: userBadges[profile.id] || [],
      }
    })

    return NextResponse.json({ data: leaderboardData })

  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
