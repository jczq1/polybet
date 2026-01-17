import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              {/* Outer pixelated border - top */}
              <rect x="8" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="16" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="24" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="32" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="40" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="48" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Outer pixelated border - bottom */}
              <rect x="8" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="16" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="24" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="32" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="40" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="48" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Outer pixelated border - left */}
              <rect x="4" y="8" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="16" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="24" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="32" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="40" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="48" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Outer pixelated border - right */}
              <rect x="56" y="8" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="16" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="24" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="32" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="40" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="48" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Inner square */}
              <rect x="12" y="12" width="40" height="40" fill="currentColor" className="text-primary"/>
              {/* Center circle (cutout effect using background color) */}
              <circle cx="32" cy="32" r="10" fill="currentColor" className="text-background"/>
              <circle cx="32" cy="32" r="6" fill="currentColor" className="text-primary"/>
            </svg>
            <span className="text-sm text-muted-foreground">
              <span className="text-primary font-semibold tracking-wide">OMEN</span> - Prediction Markets
            </span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            <Link href="/markets" className="hover:text-primary transition-colors">
              Markets
            </Link>
            <Link href="/leaderboard" className="hover:text-primary transition-colors">
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
