import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClaimBonusButton } from '@/components/auth/claim-bonus-button'
import { UserBadges } from '@/components/badges/user-badges'
import { BadgeSelector } from '@/components/badges/badge-selector'
import { DisplayBadges } from '@/components/badges/display-badges'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  // Get user's bets
  const { data: bets } = await supabase
    .from('bets')
    .select(`
      *,
      markets (*),
      market_options (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get recent transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate stats
  const totalBets = bets?.length || 0
  const activeBets = bets?.filter(b => b.markets?.status === 'open').length || 0
  const wonBets = bets?.filter(b => b.market_options?.is_winner === true).length || 0
  const lostBets = bets?.filter(b => b.market_options?.is_winner === false).length || 0

  // Check if monthly bonus can be claimed
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const canClaimBonus = !profile.last_credit_bonus_at ||
    new Date(profile.last_credit_bonus_at) < monthStart

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground">{profile.display_name}</h1>
          <DisplayBadges userId={user.id} className="text-2xl" />
        </div>
        <p className="text-muted-foreground">{profile.email}</p>
        {profile.is_admin && (
          <Badge variant="accent" className="mt-2">Admin</Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-accent">
                  {profile.credits.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Credits</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-foreground">{totalBets}</p>
                <p className="text-sm text-muted-foreground">Total Bets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-success">{wonBets}</p>
                <p className="text-sm text-muted-foreground">Won</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-error">{lostBets}</p>
                <p className="text-sm text-muted-foreground">Lost</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Bets */}
          <Card>
            <CardHeader>
              <CardTitle>Active Bets</CardTitle>
              <CardDescription>Your pending predictions</CardDescription>
            </CardHeader>
            <CardContent>
              {bets && bets.filter(b => b.markets?.status === 'open').length > 0 ? (
                <div className="space-y-4">
                  {bets
                    .filter(b => b.markets?.status === 'open')
                    .map((bet) => (
                      <div
                        key={bet.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {bet.markets?.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Picked: {bet.market_options?.option_text}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-foreground">
                            {bet.amount} credits
                          </p>
                          <p className="text-sm text-accent">
                            Potential: {bet.potential_payout}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No active bets. Browse markets to place predictions!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bet History */}
          <Card>
            <CardHeader>
              <CardTitle>Bet History</CardTitle>
              <CardDescription>Your past predictions</CardDescription>
            </CardHeader>
            <CardContent>
              {bets && bets.filter(b => b.markets?.status === 'resolved').length > 0 ? (
                <div className="space-y-4">
                  {bets
                    .filter(b => b.markets?.status === 'resolved')
                    .map((bet) => (
                      <div
                        key={bet.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            bet.market_options?.is_winner ? 'bg-success' : 'bg-error'
                          }`} />
                          <div>
                            <p className="font-medium text-foreground">
                              {bet.markets?.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Picked: {bet.market_options?.option_text}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono ${
                            bet.market_options?.is_winner ? 'text-success' : 'text-error'
                          }`}>
                            {bet.market_options?.is_winner ? '+' : '-'}{bet.amount}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No resolved bets yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Badge Selector - Customize displayed badges */}
          <BadgeSelector userId={user.id} />

          {/* All Earned Badges */}
          <UserBadges userId={user.id} />

          {/* Monthly Bonus */}
          <Card className={canClaimBonus ? 'gradient-border' : ''}>
            <CardHeader>
              <CardTitle>Monthly Bonus</CardTitle>
              <CardDescription>
                {canClaimBonus
                  ? 'Your bonus is ready to claim!'
                  : 'Come back next month for more credits'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClaimBonusButton canClaim={canClaimBonus} userId={user.id} />
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions && transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {tx.description || tx.type.replace('_', ' ')}
                      </span>
                      <span className={`font-mono ${
                        tx.amount > 0 ? 'text-success' : 'text-error'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No transactions yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="text-foreground">
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active bets</span>
                <span className="text-foreground">{activeBets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Win rate</span>
                <span className="text-foreground">
                  {totalBets > 0
                    ? `${Math.round((wonBets / (wonBets + lostBets || 1)) * 100)}%`
                    : 'N/A'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
