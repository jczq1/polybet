import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: markets } = await supabase
    .from('markets')
    .select(`
      *,
      market_options (*),
      profiles!markets_created_by_fkey (display_name)
    `)
    .order('status', { ascending: true })
    .order('closes_at', { ascending: true })

  // Group markets by status
  const openMarkets = markets?.filter(m => m.status === 'open') || []
  const closedMarkets = markets?.filter(m => m.status === 'closed') || []
  const resolvedMarkets = markets?.filter(m => m.status === 'resolved') || []

  // Get unique categories
  const categories = [...new Set(markets?.map(m => m.category) || [])]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="success" className="text-xs px-1.5 py-0.5">Open</Badge>
      case 'closed':
        return <Badge variant="warning" className="text-xs px-1.5 py-0.5">Closed</Badge>
      case 'resolved':
        return <Badge variant="default" className="text-xs px-1.5 py-0.5">Resolved</Badge>
      default:
        return null
    }
  }

  const MarketCard = ({ market }: { market: typeof openMarkets[0] }) => (
    <Link href={`/market/${market.id}`}>
      <Card hover className="h-full">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Badge className="text-xs px-1.5 py-0.5">{market.category}</Badge>
            {getStatusBadge(market.status)}
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
            {market.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {market.description}
          </p>

          {/* Options Preview - Compact */}
          <div className="space-y-1 mb-2">
            {market.market_options?.slice(0, 2).map((option: { id: string; option_text: string; is_winner: boolean | null }) => (
              <div
                key={option.id}
                className={`text-xs px-2 py-1 rounded ${
                  option.is_winner
                    ? 'bg-success/20 text-success border border-success/30'
                    : option.is_winner === false
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                <span className="line-clamp-1">{option.option_text}</span>
                {option.is_winner && ' ✓'}
              </div>
            ))}
            {(market.market_options?.length || 0) > 2 && (
              <p className="text-xs text-muted-foreground">
                +{(market.market_options?.length || 0) - 2} more
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{market.market_options?.length || 0} opts</span>
            <span>
              {market.status === 'resolved'
                ? new Date(market.resolved_at!).toLocaleDateString()
                : new Date(market.closes_at).toLocaleDateString()
              }
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Prediction Markets</h1>
        <p className="text-sm text-muted-foreground">Browse and bet on campus events</p>
      </div>

      {/* Categories Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant="secondary" size="sm" className="bg-primary/20 text-primary text-xs h-7">
            All
          </Button>
          {categories.map((cat) => (
            <Button key={cat} variant="ghost" size="sm" className="text-xs h-7">
              {cat}
            </Button>
          ))}
        </div>
      )}

      {/* Open Markets */}
      {openMarkets.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-success" />
            <h2 className="text-lg font-semibold text-foreground">
              Open Markets ({openMarkets.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {openMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </section>
      )}

      {/* Closed Markets (awaiting resolution) */}
      {closedMarkets.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <h2 className="text-lg font-semibold text-foreground">
              Awaiting Resolution ({closedMarkets.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {closedMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </section>
      )}

      {/* Resolved Markets */}
      {resolvedMarkets.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Resolved Markets ({resolvedMarkets.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {resolvedMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {(!markets || markets.length === 0) && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              No markets yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Prediction markets will appear here once they&apos;re created. Check back soon!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
