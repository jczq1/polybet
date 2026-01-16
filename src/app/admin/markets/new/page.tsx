'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeProbabilities, formatDecimalOdds } from '@/lib/oddsCalculator'

const CATEGORIES = [
  'Sports',
  'Academics',
  'Campus Events',
  'Weather',
  'Politics',
  'Entertainment',
  'Technology',
  'Other',
]

interface OptionWithOdds {
  text: string
  probability: number // 0-100 as percentage for easier input
}

export default function NewMarketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [closesAt, setClosesAt] = useState('')
  const [options, setOptions] = useState<OptionWithOdds[]>([
    { text: '', probability: 50 },
    { text: '', probability: 50 },
  ])

  // Calculate total probability
  const totalProbability = options.reduce((sum, opt) => sum + opt.probability, 0)
  const isProbabilityValid = Math.abs(totalProbability - 100) < 1

  const addOption = () => {
    if (options.length < 10) {
      // Distribute remaining probability to new option
      const remaining = Math.max(0, 100 - totalProbability)
      setOptions([...options, { text: '', probability: remaining || 10 }])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index)
      setOptions(newOptions)
    }
  }

  const updateOptionText = (index: number, text: string) => {
    const newOptions = [...options]
    newOptions[index].text = text
    setOptions(newOptions)
  }

  const updateOptionProbability = (index: number, probability: number) => {
    const newOptions = [...options]
    newOptions[index].probability = Math.max(5, Math.min(95, probability))
    setOptions(newOptions)
  }

  const distributeEvenly = () => {
    const evenProb = 100 / options.length
    setOptions(options.map(opt => ({ ...opt, probability: evenProb })))
  }

  const normalizeOdds = () => {
    const probs = options.map(o => o.probability)
    const normalized = normalizeProbabilities(probs)
    setOptions(options.map((opt, i) => ({
      ...opt,
      probability: Math.round(normalized[i] * 100 * 10) / 10
    })))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (!title.trim()) {
      setError('Title is required')
      setLoading(false)
      return
    }

    if (!description.trim()) {
      setError('Description is required')
      setLoading(false)
      return
    }

    if (!closesAt) {
      setError('Closing date is required')
      setLoading(false)
      return
    }

    const validOptions = options.filter(o => o.text.trim())
    if (validOptions.length < 2) {
      setError('At least 2 options are required')
      setLoading(false)
      return
    }

    if (!isProbabilityValid) {
      setError('Probabilities must sum to 100%')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    // Create market with initial stats
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .insert({
        title: title.trim(),
        description: description.trim(),
        category,
        created_by: user.id,
        closes_at: new Date(closesAt).toISOString(),
        total_bets: 0,
        unique_bettors: 0,
      })
      .select()
      .single()

    if (marketError) {
      setError(marketError.message)
      setLoading(false)
      return
    }

    // Normalize probabilities to ensure they sum to 1
    const probs = validOptions.map(o => o.probability)
    const normalizedProbs = normalizeProbabilities(probs)

    // Create options with initial odds
    const optionsToInsert = validOptions.map((option, index) => ({
      market_id: market.id,
      option_text: option.text.trim(),
      initial_probability: normalizedProbs[index],
      current_probability: normalizedProbs[index],
      total_pool: 0,
    }))

    const { error: optionsError } = await supabase
      .from('market_options')
      .insert(optionsToInsert)

    if (optionsError) {
      setError(optionsError.message)
      setLoading(false)
      return
    }

    router.push(`/market/${market.id}`)
  }

  // Get minimum date (now + 1 hour)
  const minDate = new Date()
  minDate.setHours(minDate.getHours() + 1)
  const minDateStr = minDate.toISOString().slice(0, 16)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Create New Market</h1>
        <p className="text-muted-foreground">Set up a new prediction market with initial odds</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Market Details</CardTitle>
            <CardDescription>
              Define the prediction market, options, and initial odds
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Title */}
            <Input
              label="Title"
              placeholder="e.g., Will CMU beat Pitt in the basketball game?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Description
              </label>
              <textarea
                className="w-full min-h-[100px] px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 resize-y"
                placeholder="Provide additional context about this market..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Category
              </label>
              <select
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Closes At */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Betting Closes At
              </label>
              <input
                type="datetime-local"
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                min={minDateStr}
                required
              />
            </div>

            {/* Options with Odds */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Options &amp; Initial Odds
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={distributeEvenly}
                  >
                    Even Split
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={normalizeOdds}
                  >
                    Normalize
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Set the initial probability (odds) for each outcome. Total must equal 100%.
              </p>

              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => updateOptionText(index, e.target.value)}
                      />
                    </div>
                    <div className="w-24">
                      <div className="relative">
                        <input
                          type="number"
                          min={5}
                          max={95}
                          step={0.1}
                          value={option.probability}
                          onChange={(e) => updateOptionProbability(index, parseFloat(e.target.value) || 0)}
                          className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-right"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          %
                        </span>
                      </div>
                    </div>
                    <div className="w-16 text-center">
                      <span className="text-sm text-accent font-mono">
                        {formatDecimalOdds(100 / option.probability)}
                      </span>
                    </div>
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 text-muted-foreground hover:text-error transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Probability Total Indicator */}
              <div className={`mt-3 p-3 rounded-lg border ${
                isProbabilityValid
                  ? 'bg-success/10 border-success/30'
                  : 'bg-warning/10 border-warning/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    isProbabilityValid ? 'text-success' : 'text-warning'
                  }`}>
                    Total Probability
                  </span>
                  <span className={`text-sm font-mono ${
                    isProbabilityValid ? 'text-success' : 'text-warning'
                  }`}>
                    {totalProbability.toFixed(1)}%
                    {!isProbabilityValid && ` (need 100%)`}
                  </span>
                </div>
              </div>

              {options.length < 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addOption}
                  className="mt-3"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Option
                </Button>
              )}
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-accent text-sm">How Odds Work</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Initial odds are set by you and will dynamically adjust as users place bets.
                    The AMM algorithm uses virtual liquidity that decays with betting volume,
                    making odds more responsive as more unique users participate.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-3">
            <Link href="/admin">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading} disabled={!isProbabilityValid}>
              Create Market
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
