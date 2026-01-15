import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-bold text-xs">PM</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Polymarket - Prediction Markets
            </span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            <Link href="/markets" className="hover:text-foreground transition-colors">
              Markets
            </Link>
            <Link href="/leaderboard" className="hover:text-foreground transition-colors">
              Leaderboard
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            Predict the future
          </p>
        </div>
      </div>
    </footer>
  )
}
