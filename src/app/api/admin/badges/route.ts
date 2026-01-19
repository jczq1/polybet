import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Helper to check if user is admin
async function isAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin === true
}

/**
 * GET /api/admin/badges
 * List all badges (admin only)
 */
export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: badges, error } = await supabaseAdmin
      .from('badges')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ badges })
  } catch (error) {
    console.error('Error fetching badges:', error)
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 })
  }
}

/**
 * POST /api/admin/badges
 * Create a new badge (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, icon, image_url, condition_type, threshold, is_active, sort_order } = body

    if (!name || !description || !condition_type) {
      return NextResponse.json({ error: 'name, description, and condition_type are required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: badge, error } = await supabaseAdmin
      .from('badges')
      .insert({
        name,
        description,
        icon: icon || '🏆',
        image_url: image_url || null,
        condition_type,
        threshold: threshold || 1,
        is_active: is_active !== false,
        sort_order: sort_order || 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ badge })
  } catch (error: any) {
    console.error('Error creating badge:', error)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A badge with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create badge' }, { status: 500 })
  }
}
