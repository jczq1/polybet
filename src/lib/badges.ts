/**
 * Badge System Utilities
 *
 * This module provides functions to interact with the badge system.
 * Call these after bet placement or resolution to update stats and award badges.
 */

export interface BadgeCheckResult {
  success: boolean
  newBadges?: {
    newly_earned: Array<{
      id: string
      name: string
      icon: string
      description: string
    }>
    count: number
  }
  error?: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  image_url?: string | null
  condition_type: string
  threshold: number
  is_active: boolean
  sort_order: number
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  metadata: Record<string, any>
  badges: Badge
}

/**
 * Check badges after a bet is placed
 */
export async function checkBadgesOnBetPlaced(params: {
  userId: string
  betAmount: number
  userBalanceBefore: number
  marketId: string
  isFirstBettor: boolean
}): Promise<BadgeCheckResult> {
  try {
    const response = await fetch('/api/badges/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'bet_placed',
        ...params
      })
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error checking badges on bet placed:', error)
    return { success: false, error: 'Failed to check badges' }
  }
}

/**
 * Check badges after a bet is resolved
 */
export async function checkBadgesOnBetResolved(params: {
  userId: string
  won: boolean
  betAmount: number
  wasAllIn: boolean
  holdDurationDays: number
  probabilityAtPurchase: number
  poolPercentage: number
}): Promise<BadgeCheckResult> {
  try {
    const response = await fetch('/api/badges/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'bet_resolved',
        ...params
      })
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error checking badges on bet resolved:', error)
    return { success: false, error: 'Failed to check badges' }
  }
}

/**
 * Update leaderboard rank and check for #1 badge
 */
export async function checkBadgesOnLeaderboardUpdate(params: {
  userId: string
  rank: number
}): Promise<BadgeCheckResult> {
  try {
    const response = await fetch('/api/badges/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'leaderboard_update',
        ...params
      })
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error checking badges on leaderboard update:', error)
    return { success: false, error: 'Failed to check badges' }
  }
}

/**
 * Get all badge definitions
 */
export async function getBadgeDefinitions(): Promise<Badge[]> {
  try {
    const response = await fetch('/api/badges?type=definitions')
    const data = await response.json()
    return data.badges || []
  } catch (error) {
    console.error('Error fetching badge definitions:', error)
    return []
  }
}

/**
 * Get badges for a specific user
 */
export async function getUserBadges(userId?: string): Promise<UserBadge[]> {
  try {
    const url = userId ? `/api/badges?userId=${userId}` : '/api/badges'
    const response = await fetch(url)
    const data = await response.json()
    return data.userBadges || []
  } catch (error) {
    console.error('Error fetching user badges:', error)
    return []
  }
}

/**
 * Server-side function to check badges (for use in API routes)
 */
export async function checkBadgesServerSide(
  supabaseAdmin: any,
  userId: string,
  context: Record<string, any> = {}
): Promise<BadgeCheckResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_and_award_badges', {
      p_user_id: userId,
      p_bet_id: null,
      p_context: context
    })

    if (error) throw error

    return {
      success: true,
      newBadges: data
    }
  } catch (error) {
    console.error('Error checking badges server-side:', error)
    return { success: false, error: 'Failed to check badges' }
  }
}
