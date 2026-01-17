import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BettingPanel } from '@/components/markets/betting-panel'
import { formatProbability, formatDecimalOdds } from '@/lib/oddsCalculator'

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
  let userBets: { option_id: string; amount: number; odds_at_purchase: number; potential_payout: number }[] = []

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    userProfile = profile

    const { data: bets } = await supabase
      .from('bets')
      .select('option_id, amount, odds_at_purchase, potential_payout')
      .eq('user_id', user.id)
      .eq('market_id', id)

    userBets = bets || []
  }

  // Calculate total pool from market options
  const totalPool = market.market_options?.reduce((sum: number, opt: { total_pool: number }) => sum + (opt.total_pool || 0), 0) || 0

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
                <div>
                  <p className="text-muted-foreground">Bets</p>
                  <p className="text-foreground font-medium">
                    {market.total_bets || 0} ({market.unique_bettors || 0} unique)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Options with Odds */}
          <Card>
            <CardHeader>
              <CardTitle>Options & Odds</CardTitle>
              <CardDescription>
                {market.status === 'resolved'
                  ? 'Final results'
                  : 'Current probability and odds for each outcome'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {market.market_options?.map((option: { id: string; option_text: string; is_winner: boolean | null; current_probability: number; total_pool: number }) => {
                  const probability = option.current_probability || 0.5
                  const decimalOdds = 1 / probability
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
                        style={{ width: `${probability * 100}%` }}
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
                                Your bet: {userBet.amount} credits @ {formatProbability(userBet.odds_at_purchase)}
                                {option.is_winner && (
                                  <span className="text-success ml-1">
                                    → Won {userBet.potential_payout} credits
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-mono text-accent font-medium">
                            {formatProbability(probability)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {(option.total_pool || 0).toLocaleString()} credits
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* How Odds Work Info */}
          {market.status === 'open' && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-foreground text-sm">Dynamic Odds</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Odds update automatically as bets come in. Your payout is locked at the odds shown when you place your bet.
                      Early bettors who correctly predict unlikely outcomes earn higher returns.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Betting Panel */}
        <div>
          <BettingPanel
            market={market}
            options={market.market_options || []}
            userCredits={userProfile?.credits || 0}
            userId={user?.id}
            canBet={!!canBet}
            existingBets={userBets}
          />
        </div>
      </div>
    </div>
  )
}
