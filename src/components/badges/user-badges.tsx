'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import type { UserBadge } from '@/lib/badges'

interface UserBadgesProps {
  userId?: string
}

export function UserBadges({ userId }: UserBadgesProps) {
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBadges() {
      try {
        const url = userId ? `/api/badges?userId=${userId}` : '/api/badges'
        const response = await fetch(url)
        const data = await response.json()
        setBadges(data.userBadges || [])
      } catch (error) {
        console.error('Error fetching badges:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBadges()
  }, [userId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Loading achievements...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-16 h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Badges</CardTitle>
        <CardDescription>
          {badges.length > 0
            ? `${badges.length} achievement${badges.length > 1 ? 's' : ''} earned`
            : 'Complete challenges to earn badges'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {badges.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {badges.map((userBadge) => (
              <div
                key={userBadge.id}
                className="flex flex-col items-center p-3 rounded-lg bg-secondary border border-border hover:border-accent/50 transition-colors group"
                title={userBadge.badges.description}
              >
                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">
                  {userBadge.badges.icon}
                </span>
                <span className="text-xs font-medium text-foreground text-center">
                  {userBadge.badges.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {new Date(userBadge.earned_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-2 opacity-50">🏆</div>
            <p className="text-muted-foreground text-sm">
              No badges earned yet. Place bets and win to unlock achievements!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
