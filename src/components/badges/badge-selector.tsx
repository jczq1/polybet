'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Badge {
  id: string
  name: string
  icon: string
  image_url?: string | null
  description: string
}

interface UserBadge {
  id: string
  badge_id: string
  display_order: number | null
  badges: Badge
}

interface BadgeSelectorProps {
  userId: string
}

export function BadgeSelector({ userId }: BadgeSelectorProps) {
  const router = useRouter()
  const [allBadges, setAllBadges] = useState<UserBadge[]>([])
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]) // Up to 3 badge IDs in order
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    async function fetchBadges() {
      try {
        const response = await fetch(`/api/badges?userId=${userId}`)
        const data = await response.json()
        const badges = data.userBadges || []
        setAllBadges(badges)

        // Initialize selected badges from display_order
        const displayed = badges
          .filter((b: UserBadge) => b.display_order !== null)
          .sort((a: UserBadge, b: UserBadge) => (a.display_order || 0) - (b.display_order || 0))
          .map((b: UserBadge) => b.badge_id)
        setSelectedBadges(displayed)
      } catch (error) {
        console.error('Error fetching badges:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBadges()
  }, [userId])

  const toggleBadge = (badgeId: string) => {
    setHasChanges(true)
    if (selectedBadges.includes(badgeId)) {
      // Remove badge
      setSelectedBadges(selectedBadges.filter(id => id !== badgeId))
    } else if (selectedBadges.length < 3) {
      // Add badge
      setSelectedBadges([...selectedBadges, badgeId])
    }
  }

  const moveBadge = (badgeId: string, direction: 'left' | 'right') => {
    const index = selectedBadges.indexOf(badgeId)
    if (index === -1) return

    const newIndex = direction === 'left' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= selectedBadges.length) return

    const newSelected = [...selectedBadges]
    ;[newSelected[index], newSelected[newIndex]] = [newSelected[newIndex], newSelected[index]]
    setSelectedBadges(newSelected)
    setHasChanges(true)
  }

  const saveBadges = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/badges/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeIds: selectedBadges })
      })

      if (response.ok) {
        setHasChanges(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Error saving badges:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customize Badges</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (allBadges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customize Badges</CardTitle>
          <CardDescription>Earn badges to display them on your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            No badges earned yet. Place bets and win to unlock achievements!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customize Badges</CardTitle>
        <CardDescription>
          Select up to 3 badges to display next to your name ({selectedBadges.length}/3)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected badges preview */}
        <div className="p-3 rounded-lg bg-secondary border border-border">
          <p className="text-xs text-muted-foreground mb-2">Preview:</p>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">YourName</span>
            {selectedBadges.length > 0 ? (
              selectedBadges.map((badgeId, index) => {
                const badge = allBadges.find(b => b.badge_id === badgeId)?.badges
                return badge ? (
                  <div
                    key={badgeId}
                    className="flex items-center gap-1"
                  >
                    <span
                      className="cursor-pointer hover:scale-110 transition-transform"
                      title={`${badge.name} - Click arrows to reorder`}
                    >
                      {badge.image_url ? (
                        <img src={badge.image_url} alt={badge.name} className="w-6 h-6 object-contain" />
                      ) : (
                        <span className="text-lg">{badge.icon}</span>
                      )}
                    </span>
                    <div className="flex flex-col -space-y-1">
                      {index > 0 && (
                        <button
                          onClick={() => moveBadge(badgeId, 'left')}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          ←
                        </button>
                      )}
                      {index < selectedBadges.length - 1 && (
                        <button
                          onClick={() => moveBadge(badgeId, 'right')}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          →
                        </button>
                      )}
                    </div>
                  </div>
                ) : null
              })
            ) : (
              <span className="text-muted-foreground text-sm">No badges selected</span>
            )}
          </div>
        </div>

        {/* Badge grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allBadges.map((userBadge) => {
            const isSelected = selectedBadges.includes(userBadge.badge_id)
            const canSelect = selectedBadges.length < 3 || isSelected

            return (
              <button
                key={userBadge.id}
                onClick={() => toggleBadge(userBadge.badge_id)}
                disabled={!canSelect}
                className={`p-3 rounded-lg border text-center transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : canSelect
                    ? 'border-border bg-secondary hover:border-accent/50'
                    : 'border-border bg-secondary opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="block mb-1">
                  {userBadge.badges.image_url ? (
                    <img src={userBadge.badges.image_url} alt={userBadge.badges.name} className="w-8 h-8 object-contain mx-auto" />
                  ) : (
                    <span className="text-2xl">{userBadge.badges.icon}</span>
                  )}
                </span>
                <span className="text-xs font-medium text-foreground block">
                  {userBadge.badges.name}
                </span>
                {isSelected && (
                  <span className="text-[10px] text-accent">
                    #{selectedBadges.indexOf(userBadge.badge_id) + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Save button */}
        {hasChanges && (
          <Button
            onClick={saveBadges}
            loading={saving}
            className="w-full"
          >
            Save Badge Selection
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
