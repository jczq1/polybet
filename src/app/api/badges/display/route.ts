import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/badges/display?userId=xxx
 * Get displayed badges for a user (up to 3)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.rpc('get_displayed_badges', {
      p_user_id: userId
    })

    if (error) {
      console.error('Error fetching displayed badges:', error)
      return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 })
    }

    return NextResponse.json({ badges: data || [] })
  } catch (error) {
    console.error('Error in badges display GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/badges/display
 * Update displayed badges for current user
 * Body: { badgeIds: string[] } - array of up to 3 badge IDs in display order
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { badgeIds } = body

    if (!Array.isArray(badgeIds)) {
      return NextResponse.json({ error: 'badgeIds must be an array' }, { status: 400 })
    }

    if (badgeIds.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 badges can be displayed' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.rpc('set_displayed_badges', {
      p_user_id: user.id,
      p_badge_ids: badgeIds
    })

    if (error) {
      console.error('Error setting displayed badges:', error)
      return NextResponse.json({ error: 'Failed to update badges' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('Error in badges display POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
