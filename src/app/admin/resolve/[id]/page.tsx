'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Market, MarketOption } from '@/types/database'

interface ResolvePageProps {
  params: Promise<{ id: string }>
}

export default function ResolvePage({ params }: ResolvePageProps) {
  const router = useRouter()
  const [marketId, setMarketId] = useState<string | null>(null)
  const [market, setMarket] = useState<Market | null>(null)
  const [options, setOptions] = useState<MarketOption[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    params.then(p => setMarketId(p.id))
  }, [params])

  useEffect(() => {
    if (!marketId) return

    async function fetchMarket() {
      const supabase = createClient()

      const { data } = await supabase
        .from('markets')
        .select(`
          *,
          market_options (*)
        `)
        .eq('id', marketId)
        .single()

      if (data) {
        setMarket(data)
        setOptions(data.market_options || [])
      }
      setLoading(false)
    }

    fetchMarket()
  }, [marketId])

  const handleResolve = async () => {
    if (!selectedOption || !marketId) return

    setResolving(true)
    setError('')

    const supabase = createClient()

    // First, close the market if it's still open
    if (market?.status === 'open') {
      await supabase
        .from('markets')
        .update({ status: 'closed' })
        .eq('id', marketId)
    }

    // Resolve the market using the odds-aware function
    const { error: resolveError } = await supabase
      .rpc('resolve_market_with_odds', {
        p_market_id: marketId,
        p_winning_option_id: selectedOption,
      })

    if (resolveError) {
      setError(resolveError.message)
      setResolving(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-16">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 bg-muted rounded-full mb-4" />
              <div className="h-6 w-48 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Market not found</p>
            <Link href="/admin/resolve">
              <Button variant="ghost" className="mt-4">Go back</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (market.status === 'resolved') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Already Resolved</h3>
            <p className="text-muted-foreground">This market has already been resolved</p>
            <Link href="/admin">
              <Button variant="ghost" className="mt-4">Go to Admin</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/admin/resolve" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Resolution List
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Resolve Market</h1>
        <p className="text-muted-foreground">Select the winning outcome</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge>{market.category}</Badge>
            <Badge variant="warning">Pending Resolution</Badge>
          </div>
          <CardTitle>{market.title}</CardTitle>
          <CardDescription>{market.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Select the winning outcome:
            </label>
            <div className="space-y-3">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedOption === option.id
                      ? 'border-success bg-success/10'
                      : 'border-border bg-secondary hover:border-success/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      selectedOption === option.id ? 'text-success' : 'text-foreground'
                    }`}>
                      {option.option_text}
                    </span>
                    {selectedOption === option.id && (
                      <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedOption && (
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium text-warning">This action cannot be undone</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Resolving this market will distribute winnings to all users who bet on the winning option.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Link href="/admin/resolve">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button
            onClick={handleResolve}
            loading={resolving}
            disabled={!selectedOption}
            className="bg-success hover:bg-success/90"
          >
            Resolve Market
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
