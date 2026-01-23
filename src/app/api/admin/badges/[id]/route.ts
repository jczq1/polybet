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

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/badges/[id]
 * Get a single badge (admin only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: badge, error } = await supabaseAdmin
      .from('badges')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({ badge })
  } catch (error) {
    console.error('Error fetching badge:', error)
    return NextResponse.json({ error: 'Failed to fetch badge' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/badges/[id]
 * Update a badge (admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, icon, image_url, condition_type, threshold, is_active, sort_order } = body

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Build update object with only provided fields
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (icon !== undefined) updates.icon = icon
    if (image_url !== undefined) updates.image_url = image_url
    if (condition_type !== undefined) updates.condition_type = condition_type
    if (threshold !== undefined) updates.threshold = threshold
    if (is_active !== undefined) updates.is_active = is_active
    if (sort_order !== undefined) updates.sort_order = sort_order

    const { data: badge, error } = await supabaseAdmin
      .from('badges')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ badge })
  } catch (error: any) {
    console.error('Error updating badge:', error)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A badge with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update badge' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/badges/[id]
 * Delete a badge (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if badge has been earned by any users
    const { data: earnedCount } = await supabaseAdmin
      .from('user_badges')
      .select('id', { count: 'exact', head: true })
      .eq('badge_id', id)

    const { error } = await supabaseAdmin
      .from('badges')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: earnedCount ? `Badge deleted. ${earnedCount} user awards were also removed.` : 'Badge deleted.'
    })
  } catch (error) {
    console.error('Error deleting badge:', error)
    return NextResponse.json({ error: 'Failed to delete badge' }, { status: 500 })
  }
}
