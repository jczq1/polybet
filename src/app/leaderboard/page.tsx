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
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, credits')

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

  const top3 = leaderboardData.slice(0, 3)
  const rest = leaderboardData.slice(3, 50)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-foreground mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top predictors ranked by 30-day ROI</p>
      </div>

      {/* Podium - Top 3 */}
      {top3.length >= 3 && (
        <div className="mb-10">
          <div className="flex items-end justify-center gap-4 mb-6">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center mb-3 shadow-lg">
                <span className="text-3xl">🥈</span>
              </div>
              <div className="bg-gradient-to-t from-gray-400 to-gray-300 rounded-t-lg w-28 h-24 flex flex-col items-center justify-end pb-3">
                <p className="font-bold text-black text-sm truncate w-full text-center px-1">
                  {top3[1]?.display_name}
                </p>
                <p className="text-xs text-black/70 font-mono">
                  {top3[1]?.credits.toLocaleString()}
                </p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center -mt-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mb-3 shadow-xl ring-4 ring-yellow-400/30">
                <span className="text-4xl">🥇</span>
              </div>
              <div className="bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-lg w-32 h-32 flex flex-col items-center justify-end pb-3">
                <p className="font-bold text-black text-sm truncate w-full text-center px-1">
                  {top3[0]?.display_name}
                </p>
                <p className="text-xs text-black/70 font-mono">
                  {top3[0]?.credits.toLocaleString()}
                </p>
                <Badge className="mt-1 bg-black/20 text-black border-0">
                  {top3[0]?.roi_percentage >= 0 ? '+' : ''}{top3[0]?.roi_percentage.toFixed(1)}% ROI
                </Badge>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center mb-3 shadow-lg">
                <span className="text-3xl">🥉</span>
              </div>
              <div className="bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-lg w-28 h-20 flex flex-col items-center justify-end pb-3">
                <p className="font-bold text-white text-sm truncate w-full text-center px-1">
                  {top3[2]?.display_name}
                </p>
                <p className="text-xs text-white/70 font-mono">
                  {top3[2]?.credits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current User Position (if logged in and not in top 3) */}
      {user && currentUserRank >= 3 && (
        <Card className="mb-6 gradient-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                  #{currentUserRank + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {leaderboardData[currentUserRank]?.display_name}
                    <Badge variant="accent" className="ml-2">You</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">Your current position</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-mono font-bold text-lg ${
                  leaderboardData[currentUserRank]?.roi_percentage >= 0 ? 'text-success' : 'text-error'
                }`}>
                  {leaderboardData[currentUserRank]?.roi_percentage >= 0 ? '+' : ''}
                  {leaderboardData[currentUserRank]?.roi_percentage.toFixed(1)}% ROI
                </p>
                <p className="text-sm text-accent font-mono">
                  {leaderboardData[currentUserRank]?.credits.toLocaleString()} credits
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rest of Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
          <CardDescription>
            All predictors ranked by performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rest.length > 0 ? (
            <div className="space-y-1">
              {rest.map((entry, index) => {
                const actualRank = index + 4
                const isCurrentUser = user && entry.id === user.id

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                      isCurrentUser
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                        {actualRank}
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
                        {entry.credits.toLocaleString()} credits
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : leaderboardData.length <= 3 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Only {leaderboardData.length} predictor{leaderboardData.length !== 1 ? 's' : ''} so far. Join and climb the ranks!
              </p>
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
