'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculatePotentialPayout, formatProbability, formatDecimalOdds } from '@/lib/oddsCalculator'
import type { Market, MarketOption } from '@/types/database'

interface BettingPanelProps {
  market: Market
  options: MarketOption[]
  userCredits: number
  userId?: string
  canBet: boolean
  existingBets: { option_id: string; amount: number; odds_at_purchase?: number; potential_payout?: number }[]
}

export function BettingPanel({
  market,
  options,
  userCredits,
  userId,
  canBet,
  existingBets,
}: BettingPanelProps) {
  const router = useRouter()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const betAmount = parseInt(amount) || 0

  // Get current probability for selected option
  const selectedOptionData = options.find(o => o.id === selectedOption)
  const currentProbability = selectedOptionData?.current_probability || 0.5

  // Calculate potential payout using odds-based formula
  const potentialPayout = selectedOption && betAmount > 0
    ? calculatePotentialPayout(betAmount, currentProbability)
    : 0

  const handleBet = async () => {
    if (!selectedOption || betAmount <= 0 || !userId) return

    setLoading(true)
    setError('')

    const supabase = createClient()

    // Use the new odds-aware betting function
    const { data, error: betError } = await supabase
      .rpc('place_bet_with_odds', {
        p_user_id: userId,
        p_market_id: market.id,
        p_option_id: selectedOption,
        p_amount: betAmount,
      })

    if (betError) {
      setError(betError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      setTimeout(() => {
        router.refresh()
      }, 1500)
    }
  }

  const quickAmounts = [10, 25, 50, 100, 250]

  if (success) {
    return (
      <Card className="gradient-border">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Bet Placed!</h3>
          <p className="text-muted-foreground">
            You bet {betAmount} credits on{' '}
            {options.find(o => o.id === selectedOption)?.option_text}
          </p>
          <p className="text-sm text-accent mt-2">
            Locked at {formatProbability(currentProbability)} odds
          </p>
        </CardContent>
      </Card>
    )
  }

  if (market.status === 'resolved') {
    const winningOption = options.find(o => o.is_winner)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Resolved</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-2">Winning outcome:</p>
            <p className="text-xl font-semibold text-success">
              {winningOption?.option_text || 'No winner'}
            </p>
          </div>
          {existingBets.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Your bets:</p>
              {existingBets.map((bet) => {
                const option = options.find(o => o.id === bet.option_id)
                const isWinner = option?.is_winner
                return (
                  <div key={bet.option_id} className="flex justify-between text-sm mb-1">
                    <span className={isWinner ? 'text-success' : 'text-foreground'}>
                      {option?.option_text}
                      {isWinner && ' ✓'}
                    </span>
                    <div className="text-right">
                      <span className="font-mono">{bet.amount}</span>
                      {bet.odds_at_purchase && (
                        <span className="text-muted-foreground text-xs ml-2">
                          @ {formatProbability(bet.odds_at_purchase)}
                        </span>
                      )}
                      {isWinner && bet.potential_payout && (
                        <span className="text-success ml-2">
                          → {bet.potential_payout}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Place a Bet</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Sign in to place bets on this market
          </p>
          <Link href="/auth/login">
            <Button>Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (!canBet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Betting Closed</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            This market is no longer accepting bets
          </p>
          {existingBets.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border text-left">
              <p className="text-sm text-muted-foreground mb-2">Your bets:</p>
              {existingBets.map((bet) => {
                const option = options.find(o => o.id === bet.option_id)
                return (
                  <div key={bet.option_id} className="flex justify-between text-sm">
                    <span>{option?.option_text}</span>
                    <div>
                      <span className="font-mono">{bet.amount}</span>
                      {bet.odds_at_purchase && (
                        <span className="text-muted-foreground text-xs ml-2">
                          @ {formatProbability(bet.odds_at_purchase)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Place a Bet</CardTitle>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your balance:</span>
          <span className="text-accent font-mono font-medium">
            {userCredits.toLocaleString()} credits
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Option Selection with Odds */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Select outcome
          </label>
          <div className="space-y-2">
            {options.map((option) => {
              const isSelected = selectedOption === option.id
              const probability = option.current_probability || 0.5
              const decimalOdds = 1 / probability

              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {option.option_text}
                    </span>
                    <span className={`text-sm font-mono ${isSelected ? 'text-primary' : 'text-accent'}`}>
                      {formatProbability(probability)}
                    </span>
                  </div>
                  {/* Probability bar */}
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isSelected ? 'bg-primary' : 'bg-accent/50'
                      }`}
                      style={{ width: `${probability * 100}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Bet amount
          </label>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            max={userCredits}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                onClick={() => setAmount(String(Math.min(qa, userCredits)))}
                className="px-3 py-1 text-sm rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                {qa}
              </button>
            ))}
            <button
              onClick={() => setAmount(String(userCredits))}
              className="px-3 py-1 text-sm rounded-md bg-accent/20 hover:bg-accent/30 text-accent transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Potential Payout - with locked odds display */}
        {selectedOption && betAmount > 0 && (
          <div className="p-4 rounded-lg bg-secondary border border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Your odds (locked at purchase)</span>
              <span className="text-accent font-mono">
                {formatProbability(currentProbability)}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Potential payout</span>
              <span className="text-success font-mono font-medium">
                {potentialPayout.toLocaleString()} credits
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Potential profit</span>
              <span className="text-success font-mono">
                +{(potentialPayout - betAmount).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Existing Bets */}
        {existingBets.length > 0 && (
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-sm font-medium text-accent mb-2">
              Your existing bets on this market:
            </p>
            {existingBets.map((bet, index) => {
              const option = options.find(o => o.id === bet.option_id)
              return (
                <div key={`${bet.option_id}-${index}`} className="flex justify-between text-sm">
                  <span className="text-foreground">{option?.option_text}</span>
                  <div>
                    <span className="font-mono text-foreground">{bet.amount}</span>
                    {bet.odds_at_purchase && (
                      <span className="text-muted-foreground text-xs ml-2">
                        @ {formatProbability(bet.odds_at_purchase)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
            {error}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleBet}
          loading={loading}
          disabled={!selectedOption || betAmount <= 0 || betAmount > userCredits}
          className="w-full"
        >
          {!selectedOption
            ? 'Select an option'
            : betAmount <= 0
            ? 'Enter amount'
            : betAmount > userCredits
            ? 'Insufficient credits'
            : `Place Bet - ${betAmount} credits`
          }
        </Button>
      </CardFooter>
    </Card>
  )
}
