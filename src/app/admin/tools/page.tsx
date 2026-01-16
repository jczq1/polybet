'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { calculateNewProbability, calculatePotentialPayout, formatProbability, formatDecimalOdds, ODDS_CONFIG } from '@/lib/oddsCalculator'

interface Market {
  id: string
  title: string
  description: string
  category: string
  status: string
  closes_at: string
  total_bets: number
  unique_bettors: number
  market_options: MarketOption[]
}

interface MarketOption {
  id: string
  option_text: string
  current_probability: number
  initial_probability: number
  total_pool: number
}

interface User {
  id: string
  email: string
  display_name: string
  credits: number
  is_admin: boolean
  is_test_user?: boolean
}

interface Bet {
  id: string
  user_id: string
  amount: number
  odds_at_purchase: number
  potential_payout: number
  created_at: string
  profiles?: { display_name: string }
  market_options?: { option_text: string }
}

type ActiveTab = 'markets' | 'simulator' | 'users' | 'history'

export default function AdminToolsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('markets')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Markets state
  const [markets, setMarkets] = useState<Market[]>([])
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [editingMarket, setEditingMarket] = useState(false)
  const [marketForm, setMarketForm] = useState({ title: '', description: '', category: '', closes_at: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' })

  // Simulator state
  const [simMarket, setSimMarket] = useState<Market | null>(null)
  const [simOption, setSimOption] = useState<string>('')
  const [simAmount, setSimAmount] = useState('100')
  const [simResult, setSimResult] = useState<{
    currentProb: number
    newProb: number
    virtualLiquidity: number
    diversityFactor: number
    effectiveDecayRate: number
    potentialPayout: number
  } | null>(null)

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [creditAdjustment, setCreditAdjustment] = useState('')
  const [impersonating, setImpersonating] = useState<string | null>(null)

  // Test user creation
  const [testEmail, setTestEmail] = useState('')
  const [testDisplayName, setTestDisplayName] = useState('')
  const [testCredits, setTestCredits] = useState('1000')

  // Bet history state
  const [historyMarket, setHistoryMarket] = useState<Market | null>(null)
  const [betHistory, setBetHistory] = useState<Bet[]>([])

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  async function checkAdminAndLoad() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      window.location.href = '/'
      return
    }

    setIsAdmin(true)
    await Promise.all([loadMarkets(), loadUsers()])
    setLoading(false)
  }

  async function loadMarkets() {
    const supabase = createClient()
    const { data } = await supabase
      .from('markets')
      .select('*, market_options(*)')
      .order('created_at', { ascending: false })
    setMarkets(data || [])
  }

  async function loadUsers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
  }

  // Market Functions
  async function updateMarket() {
    if (!selectedMarket) return
    setActionLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('markets')
      .update({
        title: marketForm.title,
        description: marketForm.description,
        category: marketForm.category,
        closes_at: marketForm.closes_at,
      })
      .eq('id', selectedMarket.id)

    if (error) {
      setActionMessage({ type: 'error', text: error.message })
    } else {
      setActionMessage({ type: 'success', text: 'Market updated successfully' })
      await loadMarkets()
      setEditingMarket(false)
    }
    setActionLoading(false)
  }

  async function resolveMarketEarly(winningOptionId: string) {
    if (!selectedMarket) return
    setActionLoading(true)
    const supabase = createClient()

    // Close market first if open
    if (selectedMarket.status === 'open') {
      await supabase
        .from('markets')
        .update({ status: 'closed' })
        .eq('id', selectedMarket.id)
    }

    const { error } = await supabase.rpc('resolve_market_with_odds', {
      p_market_id: selectedMarket.id,
      p_winning_option_id: winningOptionId,
    })

    if (error) {
      setActionMessage({ type: 'error', text: error.message })
    } else {
      setActionMessage({ type: 'success', text: 'Market resolved successfully' })
      await loadMarkets()
      setSelectedMarket(null)
    }
    setActionLoading(false)
  }

  async function cancelMarket() {
    if (!selectedMarket || !cancelReason) return
    setActionLoading(true)
    const supabase = createClient()

    // Get all bets for this market
    const { data: bets } = await supabase
      .from('bets')
      .select('user_id, amount')
      .eq('market_id', selectedMarket.id)

    // Refund each bet
    if (bets) {
      for (const bet of bets) {
        // Add credits back to user
        await supabase.rpc('add_credits_to_user', {
          p_user_id: bet.user_id,
          p_amount: bet.amount,
        }).catch(() => {
          // Fallback: direct update if RPC doesn't exist
          supabase
            .from('profiles')
            .update({ credits: supabase.rpc('increment_credits', { amount: bet.amount }) })
            .eq('id', bet.user_id)
        })

        // Actually just do direct SQL
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', bet.user_id)
          .single()

        if (profile) {
          await supabase
            .from('profiles')
            .update({ credits: profile.credits + bet.amount })
            .eq('id', bet.user_id)
        }

        // Record refund transaction
        await supabase.from('transactions').insert({
          user_id: bet.user_id,
          amount: bet.amount,
          type: 'bet_refund',
          description: `Market cancelled: ${cancelReason}`,
        })
      }
    }

    // Update market status
    const { error } = await supabase
      .from('markets')
      .update({
        status: 'cancelled',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', selectedMarket.id)

    if (error) {
      setActionMessage({ type: 'error', text: error.message })
    } else {
      setActionMessage({ type: 'success', text: `Market cancelled. ${bets?.length || 0} bets refunded.` })
      await loadMarkets()
      setSelectedMarket(null)
      setCancelReason('')
    }
    setActionLoading(false)
  }

  // Simulator Functions
  function simulateBet() {
    if (!simMarket || !simOption || !simAmount) return

    const option = simMarket.market_options.find(o => o.id === simOption)
    if (!option) return

    const amount = parseInt(simAmount)
    const totalBetsOnMarket = simMarket.total_bets
    const uniqueBettors = simMarket.unique_bettors
    const currentProbability = option.current_probability
    const outcomePool = option.total_pool
    const totalPool = simMarket.market_options.reduce((sum, o) => sum + o.total_pool, 0)

    // Calculate diversity factor
    const diversityFactor = Math.min(uniqueBettors / ODDS_CONFIG.DIVERSITY_THRESHOLD, 1.0)

    // Calculate effective decay rate
    const effectiveDecayRate = ODDS_CONFIG.BASE_DECAY_RATE + (ODDS_CONFIG.DIVERSITY_DECAY_BONUS * diversityFactor)

    // Calculate virtual liquidity
    const virtualLiquidity = ODDS_CONFIG.MAX_VIRTUAL_LIQUIDITY * Math.exp(-totalBetsOnMarket / effectiveDecayRate)

    // Calculate new probability using the algorithm
    const result = calculateNewProbability({
      currentProbability,
      betAmount: amount,
      outcomePool,
      totalPool,
      totalBetsOnMarket,
      uniqueBettors,
    })

    const potentialPayout = calculatePotentialPayout(amount, currentProbability)

    setSimResult({
      currentProb: currentProbability,
      newProb: result.newProbability,
      virtualLiquidity,
      diversityFactor,
      effectiveDecayRate,
      potentialPayout,
    })
  }

  // User Functions
  async function adjustCredits(userId: string, amount: number) {
    setActionLoading(true)
    const supabase = createClient()

    const user = users.find(u => u.id === userId)
    if (!user) return

    const newCredits = Math.max(0, user.credits + amount)

    const { error } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', userId)

    if (!error) {
      await supabase.from('transactions').insert({
        user_id: userId,
        amount: amount,
        type: amount > 0 ? 'monthly_bonus' : 'bet_placed',
        description: `Admin adjustment: ${amount > 0 ? '+' : ''}${amount} credits`,
      })

      setActionMessage({ type: 'success', text: `Credits adjusted. New balance: ${newCredits}` })
      await loadUsers()
    } else {
      setActionMessage({ type: 'error', text: error.message })
    }
    setActionLoading(false)
  }

  async function createTestUser() {
    if (!testEmail || !testDisplayName) return
    setActionLoading(true)

    try {
      const response = await fetch('/api/admin/create-test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          displayName: testDisplayName,
          credits: parseInt(testCredits) || 1000,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setActionMessage({ type: 'error', text: data.error })
      } else {
        setActionMessage({ type: 'success', text: data.message })
        setTestEmail('')
        setTestDisplayName('')
        setTestCredits('1000')
        await loadUsers()
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Failed to create test user' })
    }
    setActionLoading(false)
  }

  async function placeBetAsUser(userId: string, marketId: string, optionId: string, amount: number) {
    setActionLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.rpc('place_bet_with_odds', {
      p_user_id: userId,
      p_market_id: marketId,
      p_option_id: optionId,
      p_amount: amount,
    })

    if (error) {
      setActionMessage({ type: 'error', text: error.message })
    } else {
      setActionMessage({ type: 'success', text: `Bet placed successfully as user` })
      await Promise.all([loadMarkets(), loadUsers()])
    }
    setActionLoading(false)
  }

  // History Functions
  async function loadBetHistory(marketId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('bets')
      .select('*, profiles(display_name), market_options(option_text)')
      .eq('market_id', marketId)
      .order('created_at', { ascending: true })

    setBetHistory(data || [])
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-muted rounded mb-4" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Admin Tools</h1>
        <p className="text-muted-foreground">Advanced tools for testing and debugging</p>
      </div>

      {/* Action Message */}
      {actionMessage.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          actionMessage.type === 'success' ? 'bg-success/10 border border-success/20 text-success' : 'bg-error/10 border border-error/20 text-error'
        }`}>
          {actionMessage.text}
          <button onClick={() => setActionMessage({ type: '', text: '' })} className="float-right">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border pb-2">
        {(['markets', 'simulator', 'users', 'history'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'markets' ? 'Market Management' :
             tab === 'simulator' ? 'Bet Simulator' :
             tab === 'users' ? 'User Management' :
             'Odds History'}
          </button>
        ))}
      </div>

      {/* Market Management Tab */}
      {activeTab === 'markets' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Market List */}
          <Card>
            <CardHeader>
              <CardTitle>Markets</CardTitle>
              <CardDescription>Select a market to manage</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <div className="space-y-2">
                {markets.map(market => (
                  <button
                    key={market.id}
                    onClick={() => {
                      setSelectedMarket(market)
                      setMarketForm({
                        title: market.title,
                        description: market.description,
                        category: market.category,
                        closes_at: market.closes_at.slice(0, 16),
                      })
                      setEditingMarket(false)
                    }}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedMarket?.id === market.id
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{market.title}</span>
                      <Badge variant={
                        market.status === 'open' ? 'success' :
                        market.status === 'closed' ? 'warning' :
                        market.status === 'resolved' ? 'default' : 'default'
                      }>{market.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {market.total_bets} bets • {market.unique_bettors} bettors
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Market Actions */}
          {selectedMarket && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedMarket.title}</CardTitle>
                <CardDescription>Manage this market</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Edit Market */}
                {editingMarket ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={marketForm.title}
                        onChange={e => setMarketForm({ ...marketForm, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <textarea
                        className="w-full p-2 rounded-lg bg-secondary border border-border text-foreground"
                        rows={3}
                        value={marketForm.description}
                        onChange={e => setMarketForm({ ...marketForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <Input
                          value={marketForm.category}
                          onChange={e => setMarketForm({ ...marketForm, category: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Closes At</label>
                        <Input
                          type="datetime-local"
                          value={marketForm.closes_at}
                          onChange={e => setMarketForm({ ...marketForm, closes_at: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={updateMarket} loading={actionLoading}>Save Changes</Button>
                      <Button variant="ghost" onClick={() => setEditingMarket(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setEditingMarket(true)} variant="outline" className="w-full">
                    Edit Market Info
                  </Button>
                )}

                {/* Resolve Early */}
                {(selectedMarket.status === 'open' || selectedMarket.status === 'closed') && (
                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-3">Resolve Market Early</h4>
                    <div className="space-y-2">
                      {selectedMarket.market_options.map(option => (
                        <button
                          key={option.id}
                          onClick={() => resolveMarketEarly(option.id)}
                          disabled={actionLoading}
                          className="w-full p-3 rounded-lg bg-success/10 border border-success/30 text-left hover:bg-success/20 transition-colors"
                        >
                          <span className="text-success font-medium">
                            Resolve: {option.option_text}
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            {formatProbability(option.current_probability)} probability
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cancel Market */}
                {selectedMarket.status !== 'resolved' && selectedMarket.status !== 'cancelled' && (
                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-3 text-error">Cancel Market</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      This will refund all {selectedMarket.total_bets} bets and mark the market as cancelled.
                    </p>
                    <Input
                      placeholder="Reason for cancellation..."
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      className="mb-2"
                    />
                    <Button
                      onClick={cancelMarket}
                      loading={actionLoading}
                      disabled={!cancelReason}
                      className="bg-error hover:bg-error/90"
                    >
                      Cancel Market & Refund Bets
                    </Button>
                  </div>
                )}

                {/* Market Stats */}
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Market Stats</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Bets</p>
                      <p className="font-mono">{selectedMarket.total_bets}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unique Bettors</p>
                      <p className="font-mono">{selectedMarket.unique_bettors}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Pool</p>
                      <p className="font-mono">
                        {selectedMarket.market_options.reduce((s, o) => s + o.total_pool, 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge>{selectedMarket.status}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bet Simulator Tab */}
      {activeTab === 'simulator' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Bet Simulator</CardTitle>
              <CardDescription>Preview odds changes without placing real bets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Market</label>
                <select
                  className="w-full p-2 rounded-lg bg-secondary border border-border text-foreground"
                  value={simMarket?.id || ''}
                  onChange={e => {
                    const m = markets.find(m => m.id === e.target.value)
                    setSimMarket(m || null)
                    setSimOption('')
                    setSimResult(null)
                  }}
                >
                  <option value="">Select a market...</option>
                  {markets.filter(m => m.status === 'open').map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>

              {simMarket && (
                <>
                  <div>
                    <label className="text-sm font-medium">Select Option</label>
                    <select
                      className="w-full p-2 rounded-lg bg-secondary border border-border text-foreground"
                      value={simOption}
                      onChange={e => setSimOption(e.target.value)}
                    >
                      <option value="">Select an option...</option>
                      {simMarket.market_options.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.option_text} ({formatProbability(o.current_probability)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Bet Amount</label>
                    <Input
                      type="number"
                      value={simAmount}
                      onChange={e => setSimAmount(e.target.value)}
                      min={1}
                    />
                  </div>

                  <Button onClick={simulateBet} disabled={!simOption}>
                    Simulate Bet
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Simulation Results */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Results</CardTitle>
              <CardDescription>Odds calculation breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {simResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Current Probability</p>
                      <p className="text-2xl font-bold text-foreground">
                        {formatProbability(simResult.currentProb)}
                      </p>
                      <p className="text-sm text-accent">
                        {formatDecimalOdds(1/simResult.currentProb)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                      <p className="text-xs text-muted-foreground">New Probability</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatProbability(simResult.newProb)}
                      </p>
                      <p className="text-sm text-accent">
                        {formatDecimalOdds(1/simResult.newProb)}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-secondary space-y-3">
                    <h4 className="font-medium">Algorithm Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Virtual Liquidity</p>
                        <p className="font-mono">{simResult.virtualLiquidity.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diversity Factor</p>
                        <p className="font-mono">{(simResult.diversityFactor * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Effective Decay Rate</p>
                        <p className="font-mono">{simResult.effectiveDecayRate.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Potential Payout</p>
                        <p className="font-mono text-success">{simResult.potentialPayout.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
                    <p className="text-xs text-muted-foreground">Probability Change</p>
                    <p className={`text-xl font-bold ${simResult.newProb > simResult.currentProb ? 'text-success' : 'text-error'}`}>
                      {simResult.newProb > simResult.currentProb ? '+' : ''}
                      {((simResult.newProb - simResult.currentProb) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Configure a bet simulation to see results
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
              <CardDescription>Select a user to manage</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              <div className="space-y-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{user.display_name}</span>
                      <div className="flex gap-2">
                        {user.is_admin && <Badge variant="accent">Admin</Badge>}
                        <Badge>{user.credits.toLocaleString()}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* User Actions */}
          <div className="space-y-6">
            {selectedUser && (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedUser.display_name}</CardTitle>
                  <CardDescription>{selectedUser.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Credit Adjustment */}
                  <div>
                    <h4 className="font-medium mb-2">Adjust Credits</h4>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Amount (+ or -)"
                        value={creditAdjustment}
                        onChange={e => setCreditAdjustment(e.target.value)}
                      />
                      <Button
                        onClick={() => {
                          adjustCredits(selectedUser.id, parseInt(creditAdjustment) || 0)
                          setCreditAdjustment('')
                        }}
                        disabled={!creditAdjustment}
                      >
                        Apply
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => adjustCredits(selectedUser.id, 100)}>+100</Button>
                      <Button size="sm" variant="ghost" onClick={() => adjustCredits(selectedUser.id, 500)}>+500</Button>
                      <Button size="sm" variant="ghost" onClick={() => adjustCredits(selectedUser.id, 1000)}>+1000</Button>
                      <Button size="sm" variant="ghost" onClick={() => adjustCredits(selectedUser.id, -100)}>-100</Button>
                    </div>
                  </div>

                  {/* Place Bet As User */}
                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-2">Place Bet As User</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Impersonate this user to place a bet on their behalf
                    </p>
                    <select
                      className="w-full p-2 rounded-lg bg-secondary border border-border text-foreground mb-2"
                      value={impersonating || ''}
                      onChange={e => setImpersonating(e.target.value)}
                    >
                      <option value="">Select a market...</option>
                      {markets.filter(m => m.status === 'open').map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                    {impersonating && (() => {
                      const market = markets.find(m => m.id === impersonating)
                      return market ? (
                        <div className="space-y-2">
                          {market.market_options.map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => placeBetAsUser(selectedUser.id, market.id, opt.id, 50)}
                              className="w-full p-2 rounded bg-secondary hover:bg-secondary/80 text-left text-sm"
                            >
                              Bet 50 on: {opt.option_text} ({formatProbability(opt.current_probability)})
                            </button>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>

                  {/* User Stats */}
                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-2">User Info</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Credits</p>
                        <p className="font-mono">{selectedUser.credits.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Role</p>
                        <p>{selectedUser.is_admin ? 'Admin' : 'User'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Create Test User */}
            <Card>
              <CardHeader>
                <CardTitle>Create Test User</CardTitle>
                <CardDescription>Create a user for testing (no email verification required)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Email (any format for testing)"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                />
                <Input
                  placeholder="Display Name"
                  value={testDisplayName}
                  onChange={e => setTestDisplayName(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Starting Credits"
                  value={testCredits}
                  onChange={e => setTestCredits(e.target.value)}
                />
                <Button
                  onClick={createTestUser}
                  disabled={!testEmail || !testDisplayName}
                  loading={actionLoading}
                >
                  Create Test User
                </Button>
                <p className="text-xs text-muted-foreground">
                  Note: Test users are created in the database but need auth bypass to login.
                  Use impersonation to place bets as test users.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Odds History Tab */}
      {activeTab === 'history' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Market Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Market</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <div className="space-y-2">
                {markets.map(market => (
                  <button
                    key={market.id}
                    onClick={() => {
                      setHistoryMarket(market)
                      loadBetHistory(market.id)
                    }}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      historyMarket?.id === market.id
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <span className="font-medium text-foreground text-sm">{market.title}</span>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={market.status === 'open' ? 'success' : 'default'}>{market.status}</Badge>
                      <span className="text-xs text-muted-foreground">{market.total_bets} bets</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bet History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Bet History & Odds Changes</CardTitle>
              <CardDescription>
                {historyMarket ? historyMarket.title : 'Select a market to view history'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyMarket ? (
                <div className="space-y-4">
                  {/* Current Odds */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {historyMarket.market_options.map(opt => (
                      <div key={opt.id} className="p-3 rounded-lg bg-secondary">
                        <p className="text-sm font-medium">{opt.option_text}</p>
                        <p className="text-lg font-bold text-primary">
                          {formatProbability(opt.current_probability)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pool: {opt.total_pool.toLocaleString()} • Initial: {formatProbability(opt.initial_probability)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Bet Timeline */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Bet Timeline</h4>
                    {betHistory.length > 0 ? (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {betHistory.map((bet, i) => (
                          <div key={bet.id} className="p-3 rounded-lg bg-secondary flex items-center justify-between">
                            <div>
                              <p className="text-sm">
                                <span className="font-medium">{bet.profiles?.display_name}</span>
                                {' bet '}
                                <span className="font-mono text-accent">{bet.amount}</span>
                                {' on '}
                                <span className="text-primary">{bet.market_options?.option_text}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(bet.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono">
                                @ {formatProbability(bet.odds_at_purchase)}
                              </p>
                              <p className="text-xs text-success">
                                Payout: {bet.potential_payout}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No bets placed yet</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  Select a market to view its betting history
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
