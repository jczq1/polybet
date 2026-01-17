'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LeaderboardEntry {
  id: string
  display_name: string
  credits: number
  unresolved_bets: number
  roi_30day: number
  roi_lifetime: number
  total_bets: number
}

interface UserProfile {
  id: string
  display_name: string
  credits: number
  is_admin: boolean
}

type SortBy = '30d_roi' | 'lifetime_roi' | 'total_credits' | 'total_bets'

export default function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [currentUserRank, setCurrentUserRank] = useState(-1)
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('30d_roi')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()

      // Get current user profile
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setCurrentUser(profile)
      }

      // Fetch leaderboard data from API (uses service role to bypass RLS)
      // This ensures all users see the same consistent data
      const response = await fetch('/api/leaderboard')
      const { data: leaderboardData } = await response.json()

      if (!leaderboardData) {
        setLoading(false)
        return
      }

      // Sort based on selected criteria
      sortData(leaderboardData, sortBy)
      setLeaderboardData(leaderboardData)

      // Find current user's rank and stats
      if (user) {
        const userIndex = leaderboardData.findIndex((u: LeaderboardEntry) => u.id === user.id)
        setCurrentUserRank(userIndex)
        if (userIndex >= 0) {
          setCurrentUserStats(leaderboardData[userIndex])
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [sortBy])

  const sortData = (data: LeaderboardEntry[], criteria: SortBy) => {
    switch (criteria) {
      case '30d_roi':
        data.sort((a, b) => b.roi_30day - a.roi_30day)
        break
      case 'lifetime_roi':
        data.sort((a, b) => b.roi_lifetime - a.roi_lifetime)
        break
      case 'total_credits':
        data.sort((a, b) => (b.credits + b.unresolved_bets) - (a.credits + a.unresolved_bets))
        break
      case 'total_bets':
        data.sort((a, b) => b.total_bets - a.total_bets)
        break
    }
  }

  const tabs: { key: SortBy; label: string }[] = [
    { key: '30d_roi', label: '30-Day ROI' },
    { key: 'lifetime_roi', label: 'Lifetime ROI' },
    { key: 'total_credits', label: 'Total Credits' },
    { key: 'total_bets', label: 'Total Bets' },
  ]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-muted rounded mb-4" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Profile Card */}
          {currentUser && (
            <Card className="bg-card/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xl font-bold">
                    {currentUser.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{currentUser.display_name}</p>
                    <p className="text-sm text-primary">
                      Rank #{currentUserRank >= 0 ? currentUserRank + 1 : '--'}
                    </p>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="space-y-1 mb-6">
                  <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                  </Link>
                  <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    My Credits
                  </Link>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Leaderboard
                  </div>
                </nav>

                {/* My Status */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">My Status</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">30D ROI</p>
                      <p className={`text-xl font-bold ${(currentUserStats?.roi_30day || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {(currentUserStats?.roi_30day || 0) >= 0 ? '+' : ''}
                        {(currentUserStats?.roi_30day || 0).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lifetime ROI</p>
                      <p className={`text-lg font-bold ${(currentUserStats?.roi_lifetime || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {(currentUserStats?.roi_lifetime || 0) >= 0 ? '+' : ''}
                        {(currentUserStats?.roi_lifetime || 0).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                      <p className="text-xl font-bold text-foreground">
                        {(currentUser.credits + (currentUserStats?.unresolved_bets || 0)).toLocaleString()} <span className="text-sm text-accent">credits</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentUser.credits.toLocaleString()} available + {(currentUserStats?.unresolved_bets || 0).toLocaleString()} in bets
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campus Cup Promo */}
          <Card className="bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30">
            <CardContent className="pt-6">
              <p className="text-primary font-semibold mb-2">Weekly Challenge</p>
              <p className="text-sm text-muted-foreground mb-4">
                The predictor with the highest ROI this week wins 500 bonus credits!
              </p>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-muted-foreground">3 Days Remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Predictor Leaderboard</h1>
            <p className="text-muted-foreground">
              Comparing CMU students across various performance and activity metrics.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSortBy(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  sortBy === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Leaderboard Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rank</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Predictor</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-primary uppercase tracking-wider">30D ROI</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Value</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Lifetime ROI</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Bets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.slice(0, 50).map((entry, index) => {
                      const isCurrentUser = currentUser && entry.id === currentUser.id
                      const isTop3 = index < 3

                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-border/50 transition-colors ${
                            isCurrentUser ? 'bg-primary/10' : 'hover:bg-secondary/50'
                          }`}
                        >
                          <td className="py-4 px-4">
                            <span className={`font-bold ${
                              index === 0 ? 'text-yellow-500' :
                              index === 1 ? 'text-gray-400' :
                              index === 2 ? 'text-amber-600' :
                              'text-muted-foreground'
                            }`}>
                              {index + 1}
                              {index === 0 && ' 🏆'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                isTop3 ? 'bg-gradient-to-br from-primary to-accent' : 'bg-muted text-muted-foreground'
                              }`}>
                                {entry.display_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {entry.display_name}
                                  {isCurrentUser && <span className="text-primary ml-2">(You)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">CMU Student</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1">
                              <svg className={`w-4 h-4 ${entry.roi_30day >= 0 ? 'text-success' : 'text-error'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={entry.roi_30day >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                              </svg>
                              <span className={`font-medium ${entry.roi_30day >= 0 ? 'text-success' : 'text-error'}`}>
                                {entry.roi_30day >= 0 ? '+' : ''}{entry.roi_30day.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono text-foreground">{(entry.credits + entry.unresolved_bets).toLocaleString()}</span>
                            {entry.unresolved_bets > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({entry.unresolved_bets.toLocaleString()} in bets)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`font-medium ${entry.roi_lifetime >= 0 ? 'text-success' : 'text-error'}`}>
                              {entry.roi_lifetime >= 0 ? '+' : ''}{entry.roi_lifetime.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-muted-foreground">{entry.total_bets}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {leaderboardData.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No predictions have been made yet. Be the first to climb the leaderboard!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing top {Math.min(50, leaderboardData.length)} CMU predictors
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <Button variant="outline" size="sm" disabled>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
