'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import type { Badge, UserBadge } from '@/lib/badges'

interface UserBadgesProps {
  userId?: string
}

export function UserBadges({ userId }: UserBadgesProps) {
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBadges() {
      try {
        // Fetch all badge definitions and user's earned badges in parallel
        const [definitionsRes, userBadgesRes] = await Promise.all([
          fetch('/api/badges?type=definitions'),
          fetch(userId ? `/api/badges?userId=${userId}` : '/api/badges')
        ])

        const [definitionsData, userBadgesData] = await Promise.all([
          definitionsRes.json(),
          userBadgesRes.json()
        ])

        setAllBadges(definitionsData.badges || [])
        setEarnedBadges(userBadgesData.userBadges || [])
      } catch (error) {
        console.error('Error fetching badges:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBadges()
  }, [userId])

  // Create a map of earned badge IDs for quick lookup
  const earnedBadgeMap = new Map(
    earnedBadges.map(ub => [ub.badge_id, ub])
  )

  const earnedCount = earnedBadges.length
  const totalCount = allBadges.length

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>Loading badges...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="w-full aspect-square rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
        <CardDescription>
          {earnedCount} of {totalCount} badges unlocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {allBadges.map((badge) => {
            const earned = earnedBadgeMap.get(badge.id)
            const isEarned = !!earned
            const isHovered = hoveredBadge === badge.id

            return (
              <div
                key={badge.id}
                className="relative"
                onMouseEnter={() => setHoveredBadge(badge.id)}
                onMouseLeave={() => setHoveredBadge(null)}
              >
                {/* Badge Icon */}
                <div
                  className={`
                    flex flex-col items-center justify-center p-2 rounded-lg border aspect-square
                    transition-all duration-200 cursor-default
                    ${isEarned
                      ? 'bg-secondary border-primary/30 hover:border-primary/60'
                      : 'bg-muted/30 border-border opacity-40 grayscale'
                    }
                  `}
                >
                  <span className={`text-2xl ${isEarned ? '' : 'opacity-60'}`}>
                    {badge.icon}
                  </span>
                </div>

                {/* Hover Tooltip */}
                {isHovered && (
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 pointer-events-none">
                    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-center">
                      <div className="text-2xl mb-1">{badge.icon}</div>
                      <p className={`font-medium text-sm ${isEarned ? 'text-primary' : 'text-muted-foreground'}`}>
                        {badge.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {badge.description}
                      </p>
                      {isEarned && earned && (
                        <p className="text-[10px] text-accent mt-2 border-t border-border pt-2">
                          Earned {new Date(earned.earned_at).toLocaleDateString()}
                        </p>
                      )}
                      {!isEarned && (
                        <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-2 italic">
                          Locked
                        </p>
                      )}
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-8 border-transparent border-t-border" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-px border-[7px] border-transparent border-t-card" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress indicator */}
        {totalCount > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Progress</span>
              <span>{Math.round((earnedCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(earnedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
