import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './leaderboard-client'

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get current user's profile
  let currentUserProfile = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    currentUserProfile = profile
  }

  // Try to use the view, fallback to manual calculation
  let leaderboardData: {
    id: string
    display_name: string
    credits: number
    total_wagered: number
    total_won: number
    roi_percentage: number
    total_bets?: number
  }[] = []

  const { data: viewData, error: viewError } = await supabase
    .from('leaderboard_30d')
    .select('*')
    .limit(100)

  if (viewData && !viewError) {
    leaderboardData = viewData
  } else {
    // Fallback: get profiles and calculate basic stats
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, credits')

    // Get bet counts per user
    const { data: betCounts } = await supabase
      .from('bets')
      .select('user_id')

    const betCountMap: Record<string, number> = {}
    betCounts?.forEach((bet: { user_id: string }) => {
      betCountMap[bet.user_id] = (betCountMap[bet.user_id] || 0) + 1
    })

    leaderboardData = (profiles || []).map((profile: { id: string; display_name: string; credits: number }) => ({
      id: profile.id,
      display_name: profile.display_name,
      credits: profile.credits,
      total_wagered: 0,
      total_won: 0,
      roi_percentage: 0,
      total_bets: betCountMap[profile.id] || 0,
    })).sort((a, b) => b.credits - a.credits)
  }

  return (
    <LeaderboardClient
      leaderboardData={leaderboardData}
      currentUser={user ? { id: user.id } : null}
      currentUserProfile={currentUserProfile}
    />
  )
}
