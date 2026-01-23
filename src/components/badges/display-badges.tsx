'use client'

import { useState, useEffect } from 'react'

interface DisplayBadge {
  id: string
  name: string
  icon: string
  image_url?: string | null
  description?: string
  display_order: number
}

interface DisplayBadgesProps {
  userId: string
  className?: string
}

// Helper component to render a single badge (image or emoji)
function BadgeIcon({ badge, size = 'base' }: { badge: { icon: string; image_url?: string | null; name: string }; size?: 'base' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'

  if (badge.image_url) {
    return (
      <img
        src={badge.image_url}
        alt={badge.name}
        className={`${sizeClasses} object-contain`}
      />
    )
  }

  return <>{badge.icon}</>
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
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={`${badge.name}${badge.description ? ` - ${badge.description}` : ''}`}
          className="inline-flex items-center hover:scale-110 transition-transform cursor-default"
        >
          <BadgeIcon badge={badge} />
        </span>
      ))}
    </span>
  )
}

// Server-side version that accepts pre-fetched badges
interface DisplayBadgesStaticProps {
  badges: Array<{ id: string; name: string; icon: string; image_url?: string | null; description?: string }>
  className?: string
}

export function DisplayBadgesStatic({ badges, className = '' }: DisplayBadgesStaticProps) {
  if (!badges || badges.length === 0) return null

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={`${badge.name}${badge.description ? ` - ${badge.description}` : ''}`}
          className="inline-flex items-center hover:scale-110 transition-transform cursor-default"
        >
          <BadgeIcon badge={badge} />
        </span>
      ))}
    </span>
  )
}
