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
                <span className="mb-1 group-hover:scale-110 transition-transform">
                  {userBadge.badges.image_url ? (
                    <img
                      src={userBadge.badges.image_url}
                      alt={userBadge.badges.name}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <span className="text-3xl">{userBadge.badges.icon}</span>
                  )}
                </span>
                <span className="text-xs font-medium text-foreground text-center">
                  {userBadge.badges.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {new Date(userBadge.earned_at).toLocaleDateString()}
                </span>
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
