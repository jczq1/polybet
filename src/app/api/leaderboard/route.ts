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

    // Calculate data per user
    const unresolvedBetAmounts: Record<string, number> = {}
    const betCounts: Record<string, number> = {}
    const monthlyBonuses: Record<string, number> = {}
    const signupBonuses: Record<string, number> = {}

    // For 30-day ROI
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

    const unresolvedBets30DaysAgo: Record<string, number> = {}
    const credits30DaysAgo: Record<string, number> = {}

    // Process transactions
    allTransactions?.forEach((tx: { user_id: string; amount: number; type: string; created_at: string }) => {
      if (tx.type === 'signup_bonus') {
        signupBonuses[tx.user_id] = (signupBonuses[tx.user_id] || 0) + tx.amount
      }
      if (tx.type === 'monthly_bonus') {
        monthlyBonuses[tx.user_id] = (monthlyBonuses[tx.user_id] || 0) + tx.amount
      }
    })

    // Process bets
    allBets?.forEach((bet: { user_id: string; amount: number; created_at: string; markets: { status: string } }) => {
      betCounts[bet.user_id] = (betCounts[bet.user_id] || 0) + 1

      if (bet.markets.status !== 'resolved') {
        unresolvedBetAmounts[bet.user_id] = (unresolvedBetAmounts[bet.user_id] || 0) + bet.amount

        if (bet.created_at < thirtyDaysAgoStr) {
          unresolvedBets30DaysAgo[bet.user_id] = (unresolvedBets30DaysAgo[bet.user_id] || 0) + bet.amount
        }
      }
    })

    // Calculate credits 30 days ago
    profiles?.forEach((profile: { id: string; credits: number; created_at: string }) => {
      let credits30d = profile.credits

      allTransactions?.forEach((tx: { user_id: string; amount: number; created_at: string }) => {
        if (tx.user_id === profile.id && tx.created_at >= thirtyDaysAgoStr) {
          credits30d -= tx.amount
        }
      })

      credits30DaysAgo[profile.id] = Math.max(0, credits30d)
    })

    // Calculate ROI for each user
    const DEFAULT_INITIAL_CREDITS = 1000

    const leaderboardData = (profiles || []).map((profile: { id: string; display_name: string; credits: number; created_at: string }) => {
      const currentCredits = profile.credits
      const unresolvedBets = unresolvedBetAmounts[profile.id] || 0
      const currentTotalValue = currentCredits + unresolvedBets

      const initialCredits = signupBonuses[profile.id] || DEFAULT_INITIAL_CREDITS

      // Lifetime ROI
      const totalDeposits = initialCredits + (monthlyBonuses[profile.id] || 0)
      const lifetimeRoi = totalDeposits > 0
        ? ((currentTotalValue - totalDeposits) / totalDeposits) * 100
        : 0

      // 30-Day ROI
      const wasCreatedBefore30Days = profile.created_at < thirtyDaysAgoStr

      let value30DaysAgo: number
      if (wasCreatedBefore30Days) {
        const historicalCredits = credits30DaysAgo[profile.id]
        value30DaysAgo = (historicalCredits !== undefined ? historicalCredits : initialCredits) + (unresolvedBets30DaysAgo[profile.id] || 0)
      } else {
        value30DaysAgo = initialCredits
      }

      const roi30Day = value30DaysAgo > 0
        ? ((currentTotalValue - value30DaysAgo) / value30DaysAgo) * 100
        : 0

      return {
        id: profile.id,
        display_name: profile.display_name,
        credits: profile.credits,
        unresolved_bets: unresolvedBets,
        roi_30day: roi30Day,
        roi_lifetime: lifetimeRoi,
        total_bets: betCounts[profile.id] || 0,
      }
    })

    return NextResponse.json({ data: leaderboardData })

  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
