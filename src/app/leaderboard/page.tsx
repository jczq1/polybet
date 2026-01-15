import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Try to use the view, fallback to manual calculation if it doesn't exist
  let leaderboardData: {
    id: string
    display_name: string
    credits: number
    total_wagered: number
    total_won: number
    roi_percentage: number
  }[] = []

  // First try the view
  const { data: viewData, error: viewError } = await supabase
    .from('leaderboard_30d')
    .select('*')
    .limit(100)

  if (viewData && !viewError) {
    leaderboardData = viewData
  } else {
    // Fallback: calculate manually
    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, credits')

    // Fallback: just show users by credits (simplified)
    leaderboardData = (profiles || []).map((profile: { id: string; display_name: string; credits: number }) => ({
      id: profile.id,
      display_name: profile.display_name,
      credits: profile.credits,
      total_wagered: 0,
      total_won: 0,
      roi_percentage: 0,
    })).sort((a, b) => b.credits - a.credits)
  }

  // Find current user's position
  let currentUserRank = -1
  if (user) {
    currentUserRank = leaderboardData.findIndex(u => u.id === user.id)
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  const getRankStyle = (index: number) => {
    if (index === 0) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black'
    if (index === 1) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-black'
    if (index === 2) return 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
    return 'bg-muted text-muted-foreground'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
        <p className="text-muted-foreground">Top predictors by 30-day ROI</p>
      </div>

      {/* Current User Position (if logged in and not in top 10) */}
      {user && currentUserRank >= 10 && (
        <Card className="mb-6 gradient-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  #{currentUserRank + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {leaderboardData[currentUserRank]?.display_name} (You)
                  </p>
                  <p className="text-sm text-muted-foreground">Your current position</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-mono font-medium ${
                  leaderboardData[currentUserRank]?.roi_percentage >= 0 ? 'text-success' : 'text-error'
                }`}>
                  {leaderboardData[currentUserRank]?.roi_percentage >= 0 ? '+' : ''}
                  {leaderboardData[currentUserRank]?.roi_percentage.toFixed(1)}% ROI
                </p>
                <p className="text-sm text-accent">
                  {leaderboardData[currentUserRank]?.credits.toLocaleString()} TMX
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Top Predictors</CardTitle>
          <CardDescription>
            Ranked by return on investment over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboardData.length > 0 ? (
            <div className="space-y-2">
              {leaderboardData.slice(0, 50).map((entry, index) => {
                const isCurrentUser = user && entry.id === user.id

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                      isCurrentUser
                        ? 'bg-primary/10 border border-primary/30'
                        : index < 3
                        ? 'bg-secondary'
                        : 'hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRankStyle(index)}`}>
                        {index < 3 ? getRankBadge(index) : index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">
                          {entry.display_name}
                          {isCurrentUser && (
                            <Badge variant="accent" className="ml-2">You</Badge>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Wagered: {entry.total_wagered.toLocaleString()}</span>
                          <span>Won: {entry.total_won.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-medium ${
                        entry.roi_percentage >= 0 ? 'text-success' : 'text-error'
                      }`}>
                        {entry.roi_percentage >= 0 ? '+' : ''}
                        {entry.roi_percentage.toFixed(1)}%
                      </p>
                      <p className="text-sm text-accent font-mono">
                        {entry.credits.toLocaleString()} TMX
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No predictions have been resolved yet. Be the first to climb the leaderboard!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-foreground">How ROI is calculated</p>
              <p className="text-sm text-muted-foreground mt-1">
                ROI (Return on Investment) is calculated based on your resolved bets from the last 30 days.
                It shows your profit or loss as a percentage of your total wagered amount.
                A positive ROI means you&apos;re profiting from your predictions!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
