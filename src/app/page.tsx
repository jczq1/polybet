import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch featured markets
  const { data: markets } = await supabase
    .from('markets')
    .select(`
      *,
      market_options (*)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(3)

  // Fetch leaderboard preview
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, display_name, credits')
    .order('credits', { ascending: false })
    .limit(5)

  return (
    <div className="gradient-bg">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="accent" className="mb-4">
            Beta - CMU Students Only
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold text-foreground mb-6">
            Predict the Future of
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              CMU Campus Life
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Bet on campus events, sports, academics, and more using virtual credits.
            Compete with fellow students and climb the leaderboard!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started - It&apos;s Free
              </Button>
            </Link>
            <Link href="/markets">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Browse Markets
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto">
            <div>
              <p className="text-3xl font-bold text-foreground">1000</p>
              <p className="text-sm text-muted-foreground">Starting Credits</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">+200</p>
              <p className="text-sm text-muted-foreground">Monthly Bonus</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">$0</p>
              <p className="text-sm text-muted-foreground">Real Money</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Markets */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Active Markets</h2>
              <p className="text-muted-foreground">Place your predictions now</p>
            </div>
            <Link href="/markets">
              <Button variant="ghost">View all</Button>
            </Link>
          </div>

          {markets && markets.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {markets.map((market) => (
                <Link key={market.id} href={`/market/${market.id}`}>
                  <Card hover className="h-full">
                    <CardContent>
                      <Badge className="mb-3">{market.category}</Badge>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {market.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {market.description}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {market.market_options?.length || 0} options
                        </span>
                        <span className="text-accent">
                          Closes {new Date(market.closes_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  No active markets yet. Check back soon!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="py-16 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Top Predictors</h2>
              <p className="text-muted-foreground">Leading the leaderboard</p>
            </div>
            <Link href="/leaderboard">
              <Button variant="ghost">View full leaderboard</Button>
            </Link>
          </div>

          {leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-3">
              {leaderboard.map((user, index) => (
                <Card key={user.id} className={index === 0 ? 'gradient-border' : ''}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="font-medium text-foreground">{user.display_name}</span>
                    </div>
                    <span className="text-accent font-mono">
                      {user.credits.toLocaleString()} credits
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  Be the first to join and top the leaderboard!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground">How It Works</h2>
            <p className="text-muted-foreground">Start predicting in minutes</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Sign Up',
                description: 'Create an account with your @andrew.cmu.edu email',
              },
              {
                step: '2',
                title: 'Get Credits',
                description: 'Receive 1,000 credits to start plus 200 monthly',
              },
              {
                step: '3',
                title: 'Place Bets',
                description: 'Find markets and bet on outcomes you believe in',
              },
              {
                step: '4',
                title: 'Win & Climb',
                description: 'Win credits and compete for the top of the leaderboard',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card glow className="text-center py-12">
            <CardContent>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Ready to Start Predicting?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Join your fellow CMU students and put your prediction skills to the test!
              </p>
              <Link href="/auth/signup">
                <Button size="lg">Create Your Account</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
