import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default async function ResolveListPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/')
  }

  // Fetch markets that need resolution (closed but not resolved)
  const { data: closedMarkets } = await supabase
    .from('markets')
    .select(`
      *,
      market_options (*)
    `)
    .eq('status', 'closed')
    .order('closes_at', { ascending: true })

  // Also fetch markets that are open but past their closing date
  const { data: expiredMarkets } = await supabase
    .from('markets')
    .select(`
      *,
      market_options (*)
    `)
    .eq('status', 'open')
    .lt('closes_at', new Date().toISOString())
    .order('closes_at', { ascending: true })

  const pendingMarkets = [...(expiredMarkets || []), ...(closedMarkets || [])]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Resolve Markets</h1>
        <p className="text-muted-foreground">Select the winning outcome for closed markets</p>
      </div>

      {pendingMarkets.length > 0 ? (
        <div className="space-y-4">
          {pendingMarkets.map((market) => (
            <Card key={market.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>{market.category}</Badge>
                      <Badge variant="warning">
                        {market.status === 'open' ? 'Expired' : 'Awaiting Resolution'}
                      </Badge>
                    </div>
                    <CardTitle>{market.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {market.description}
                    </CardDescription>
                  </div>
                  <Link href={`/admin/resolve/${market.id}`}>
                    <Button>Resolve</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {market.market_options?.map((option: { id: string; option_text: string }) => (
                    <span
                      key={option.id}
                      className="px-3 py-1 rounded-full bg-secondary text-sm text-foreground"
                    >
                      {option.option_text}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Closed: {new Date(market.closes_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              All caught up!
            </h3>
            <p className="text-muted-foreground">
              No markets are pending resolution
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
