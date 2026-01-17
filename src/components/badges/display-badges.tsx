'use client'

import { useState, useEffect } from 'react'

interface DisplayBadge {
  id: string
  name: string
  icon: string
  description?: string
  display_order: number
}

interface DisplayBadgesProps {
  userId: string
  className?: string
}

// Client component that fetches and displays badges
export function DisplayBadges({ userId, className = '' }: DisplayBadgesProps) {
  const [badges, setBadges] = useState<DisplayBadge[]>([])

  useEffect(() => {
    async function fetchBadges() {
      try {
        const response = await fetch(`/api/badges/display?userId=${userId}`)
        const data = await response.json()
        setBadges(data.badges || [])
      } catch (error) {
        console.error('Error fetching displayed badges:', error)
      }
    }

    fetchBadges()
  }, [userId])

  if (badges.length === 0) return null

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={`${badge.name}${badge.description ? ` - ${badge.description}` : ''}`}
          className="text-base hover:scale-110 transition-transform cursor-default"
        >
          {badge.icon}
        </span>
      ))}
    </span>
  )
}

// Server-side version that accepts pre-fetched badges
interface DisplayBadgesStaticProps {
  badges: Array<{ id: string; name: string; icon: string; description?: string }>
  className?: string
}

export function DisplayBadgesStatic({ badges, className = '' }: DisplayBadgesStaticProps) {
  if (!badges || badges.length === 0) return null

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={`${badge.name}${badge.description ? ` - ${badge.description}` : ''}`}
          className="text-base hover:scale-110 transition-transform cursor-default"
        >
          {badge.icon}
        </span>
      ))}
    </span>
  )
}
