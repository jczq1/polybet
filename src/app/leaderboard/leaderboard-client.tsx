'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface LeaderboardEntry {
  id: string
  display_name: string
  credits: number
  total_wagered: number
  total_won: number
  roi_percentage: number
  total_bets?: number
}

interface LeaderboardClientProps {
  leaderboardData: LeaderboardEntry[]
  currentUser: { id: string } | null
  currentUserProfile: {
    id: string
    display_name: string
    credits: number
    is_admin: boolean
  } | null
}

type SortOption = '30d_roi' | 'lifetime_roi' | 'total_tmx' | 'total_bets'

export function LeaderboardClient({
  leaderboardData,
  currentUser,
  currentUserProfile,
}: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<SortOption>('30d_roi')

  // Sort data based on active tab
  const sortedData = [...leaderboardData].sort((a, b) => {
    switch (activeTab) {
      case '30d_roi':
      case 'lifetime_roi':
        return b.roi_percentage - a.roi_percentage
      case 'total_tmx':
        return b.credits - a.credits
      case 'total_bets':
        return (b.total_bets || 0) - (a.total_bets || 0)
      default:
        return 0
    }
  })

  // Find current user's rank
  const currentUserRank = currentUser
    ? sortedData.findIndex(u => u.id === currentUser.id) + 1
    : -1

  const currentUserData = currentUser
    ? sortedData.find(u => u.id === currentUser.id)
    : null

  const tabs = [
    { id: '30d_roi' as const, label: '30-Day ROI' },
    { id: 'lifetime_roi' as const, label: 'Lifetime ROI' },
    { id: 'total_tmx' as const, label: 'Total TMX' },
    { id: 'total_bets' as const, label: 'Total Bets' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          {/* User Profile Card */}
          {currentUserProfile ? (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {currentUserProfile.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{currentUserProfile.display_name}</p>
                    <p className="text-sm text-primary">Rank #{currentUserRank > 0 ? currentUserRank : '-'}</p>
                  </div>
                </div>

                {/* Sidebar Nav */}
                <nav className="space-y-1">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    My TMX
                  </Link>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Leaderboard
                  </div>
                </nav>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-4">
              <CardContent className="p-4 text-center">
                <p className="text-muted-foreground text-sm mb-3">Sign in to track your rank</p>
                <Link
                  href="/auth/login"
                  className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Sign In
                </Link>
              </CardContent>
            </Card>
          )}

          {/* My Status */}
          {currentUserData && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  My Status
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">30D ROI</p>
                    <p className={`text-xl font-bold ${currentUserData.roi_percentage >= 0 ? 'text-success' : 'text-error'}`}>
                      {currentUserData.roi_percentage >= 0 ? '+' : ''}{currentUserData.roi_percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Wealth</p>
                    <p className="text-xl font-bold text-foreground">
                      {currentUserData.credits.toLocaleString()} <span className="text-sm text-muted-foreground">TMX</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Promo Card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <h3 className="text-primary font-semibold mb-2">Weekly Challenge</h3>
              <p className="text-sm text-muted-foreground mb-3">
                The predictor with the highest ROI this week wins bonus TMX!
              </p>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">3 Days Remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Predictor Leaderboard</h1>
            <p className="text-muted-foreground">
              Comparing predictors across various performance and activity metrics.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Leaderboard Table */}
          <Card>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Predictor</div>
                <div className="col-span-2 text-center">30D ROI (%)</div>
                <div className="col-span-2 text-right">Total TMX</div>
                <div className="col-span-2 text-right">Lifetime ROI</div>
                <div className="col-span-1 text-right">Bets</div>
              </div>

              {/* Table Body */}
              {sortedData.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {sortedData.slice(0, 50).map((entry, index) => {
                    const rank = index + 1
                    const isCurrentUser = currentUser && entry.id === currentUser.id
                    const isTopThree = rank <= 3

                    return (
                      <div
                        key={entry.id}
                        className={`grid grid-cols-12 gap-4 px-4 py-4 items-center transition-colors ${
                          isCurrentUser
                            ? 'bg-primary/10'
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        {/* Rank */}
                        <div className="col-span-1">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            rank === 1
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : rank === 2
                              ? 'bg-gray-400/20 text-gray-400'
                              : rank === 3
                              ? 'bg-amber-600/20 text-amber-600'
                              : 'text-muted-foreground'
                          }`}>
                            {rank}
                            {rank === 1 && <span className="ml-0.5 text-xs">★</span>}
                          </span>
                        </div>

                        {/* Predictor */}
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isTopThree
                              ? 'bg-gradient-to-br from-primary to-accent'
                              : 'bg-secondary'
                          }`}>
                            <span className={`font-medium ${isTopThree ? 'text-white' : 'text-foreground'}`}>
                              {entry.display_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {entry.display_name}
                              {isCurrentUser && (
                                <Badge variant="accent" className="ml-2 text-xs">You</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.total_wagered > 0 ? `${entry.total_wagered.toLocaleString()} wagered` : 'New predictor'}
                            </p>
                          </div>
                        </div>

                        {/* 30D ROI */}
                        <div className="col-span-2 text-center">
                          <span className={`inline-flex items-center gap-1 font-mono text-sm ${
                            entry.roi_percentage >= 0 ? 'text-success' : 'text-error'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                                entry.roi_percentage >= 0
                                  ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                                  : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                              } />
                            </svg>
                            {entry.roi_percentage >= 0 ? '+' : ''}{entry.roi_percentage.toFixed(1)}%
                          </span>
                        </div>

                        {/* Total TMX */}
                        <div className="col-span-2 text-right">
                          <span className="font-mono text-foreground">
                            {entry.credits.toLocaleString()}
                          </span>
                          <span className="text-xs text-primary ml-1">TMX</span>
                        </div>

                        {/* Lifetime ROI */}
                        <div className="col-span-2 text-right">
                          <span className={`font-mono text-sm ${
                            entry.roi_percentage >= 0 ? 'text-success' : 'text-error'
                          }`}>
                            {entry.roi_percentage >= 0 ? '+' : ''}{entry.roi_percentage.toFixed(0)}%
                          </span>
                        </div>

                        {/* Bets */}
                        <div className="col-span-1 text-right">
                          <span className="text-muted-foreground">
                            {entry.total_bets || 0}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No predictions yet. Be the first to climb the leaderboard!
                  </p>
                </div>
              )}

              {/* Footer */}
              {sortedData.length > 0 && (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing top {Math.min(50, sortedData.length)} predictors
                  </p>
                  <div className="flex gap-2">
                    <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
