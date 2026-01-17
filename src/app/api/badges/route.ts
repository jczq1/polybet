import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch badges for a user or all badge definitions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type') // 'definitions' or 'user'

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (type === 'definitions') {
      // Get all badge definitions
      const { data: badges, error } = await supabaseAdmin
        .from('badges')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      return NextResponse.json({ badges })
    }

    if (userId) {
      // Get user's earned badges
      const { data: userBadges, error } = await supabaseAdmin
        .from('user_badges')
        .select(`
          *,
          badges (*)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ userBadges })
    }

    // Get current user's badges
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userBadges, error } = await supabaseAdmin
      .from('user_badges')
      .select(`
        *,
        badges (*)
      `)
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ userBadges })

  } catch (error) {
    console.error('Error fetching badges:', error)
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 })
  }
}

// POST - Check and award badges for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, betId, context } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Call the badge checking function
    const { data, error } = await supabaseAdmin.rpc('check_and_award_badges', {
      p_user_id: userId,
      p_bet_id: betId || null,
      p_context: context || {}
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      result: data
    })

  } catch (error) {
    console.error('Error checking badges:', error)
    return NextResponse.json({ error: 'Failed to check badges' }, { status: 500 })
  }
}
