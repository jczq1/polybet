'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export default function NewMarketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [closesAt, setClosesAt] = useState('')
  const [options, setOptions] = useState(['', ''])

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
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

    const validOptions = options.filter(o => o.trim())
    if (validOptions.length < 2) {
      setError('At least 2 options are required')
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

    // Create market
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .insert({
        title: title.trim(),
        description: description.trim(),
        category,
        created_by: user.id,
        closes_at: new Date(closesAt).toISOString(),
      })
      .select()
      .single()

    if (marketError) {
      setError(marketError.message)
      setLoading(false)
      return
    }

    // Create options
    const optionsToInsert = validOptions.map(option => ({
      market_id: market.id,
      option_text: option.trim(),
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
        <p className="text-muted-foreground">Set up a new prediction market for users</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Market Details</CardTitle>
            <CardDescription>
              Define the prediction market and its options
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

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Options
              </label>
              <p className="text-sm text-muted-foreground mb-3">
                Add the possible outcomes for this market (2-10 options)
              </p>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                    />
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
            <Button type="submit" loading={loading}>
              Create Market
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
