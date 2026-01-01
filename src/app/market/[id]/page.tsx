import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BettingPanel } from '@/components/markets/betting-panel'

interface MarketPageProps {
  params: Promise<{ id: string }>
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: market } = await supabase
    .from('markets')
    .select(`
      *,
      market_options (*),
      profiles!markets_created_by_fkey (display_name)
    `)
    .eq('id', id)
    .single()

  if (!market) {
    notFound()
  }

  // Get user's profile if logged in
  let userProfile = null
  let userBets: { option_id: string; amount: number }[] = []

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    userProfile = profile

    const { data: bets } = await supabase
      .from('bets')
      .select('option_id, amount')
      .eq('user_id', user.id)
      .eq('market_id', id)

    userBets = bets || []
  }

  // Get betting statistics for each option
  const { data: allBets } = await supabase
    .from('bets')
    .select('option_id, amount')
    .eq('market_id', id)

  const totalPool = allBets?.reduce((sum, bet) => sum + bet.amount, 0) || 0
  const optionPools: Record<string, number> = {}

  allBets?.forEach((bet) => {
    optionPools[bet.option_id] = (optionPools[bet.option_id] || 0) + bet.amount
  })

  const getStatusBadge = () => {
    switch (market.status) {
      case 'open':
        return <Badge variant="success">Open for Betting</Badge>
      case 'closed':
        return <Badge variant="warning">Awaiting Resolution</Badge>
      case 'resolved':
        return <Badge variant="default">Resolved</Badge>
      default:
        return null
    }
  }

  const isExpired = new Date(market.closes_at) < new Date()
  const canBet = market.status === 'open' && !isExpired && user

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Badge>{market.category}</Badge>
                {getStatusBadge()}
              </div>
              <CardTitle className="text-2xl">{market.title}</CardTitle>
              <CardDescription className="text-base">
                {market.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p className="text-foreground font-medium">
                    {market.profiles?.display_name || 'Admin'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {market.status === 'resolved' ? 'Resolved' : 'Closes'}
                  </p>
                  <p className="text-foreground font-medium">
                    {market.status === 'resolved'
                      ? new Date(market.resolved_at!).toLocaleString()
                      : new Date(market.closes_at).toLocaleString()
                    }
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Pool</p>
                  <p className="text-accent font-medium font-mono">
                    {totalPool.toLocaleString()} credits
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle>Options</CardTitle>
              <CardDescription>
                {market.status === 'resolved'
                  ? 'Final results'
                  : 'Select an option to place your bet'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {market.market_options?.map((option: { id: string; option_text: string; is_winner: boolean | null }) => {
                  const optionPool = optionPools[option.id] || 0
                  const percentage = totalPool > 0 ? (optionPool / totalPool) * 100 : 0
                  const userBet = userBets.find(b => b.option_id === option.id)

                  return (
                    <div
                      key={option.id}
                      className={`relative overflow-hidden rounded-lg border ${
                        option.is_winner
                          ? 'border-success bg-success/10'
                          : option.is_winner === false
                          ? 'border-border bg-muted/50'
                          : 'border-border bg-secondary'
                      }`}
                    >
                      {/* Progress bar background */}
                      <div
                        className={`absolute inset-0 ${
                          option.is_winner
                            ? 'bg-success/20'
                            : 'bg-primary/10'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />

                      <div className="relative p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {option.is_winner && (
                            <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <p className={`font-medium ${
                              option.is_winner ? 'text-success' : 'text-foreground'
                            }`}>
                              {option.option_text}
                            </p>
                            {userBet && (
                              <p className="text-xs text-accent">
                                Your bet: {userBet.amount} credits
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-mono text-foreground">
                            {optionPool.toLocaleString()} credits
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Betting Panel */}
        <div>
          <BettingPanel
            market={market}
            options={market.market_options || []}
            userCredits={userProfile?.credits || 0}
            userId={user?.id}
            totalPool={totalPool}
            optionPools={optionPools}
            canBet={!!canBet}
            existingBets={userBets}
          />
        </div>
      </div>
    </div>
  )
}
