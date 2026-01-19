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
 * POST /api/admin/badges/upload
 * Upload a badge image (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const badgeId = formData.get('badgeId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP, SVG' }, { status: 400 })
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 2MB' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png'
    const filename = `badge_${badgeId || Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('badges')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (error) {
      console.error('Storage upload error:', error)
      // If bucket doesn't exist, return helpful error
      if (error.message?.includes('bucket') || error.message?.includes('not found')) {
        return NextResponse.json({
          error: 'Storage bucket "badges" not found. Please create it in Supabase Dashboard > Storage.'
        }, { status: 500 })
      }
      throw error
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('badges')
      .getPublicUrl(filename)

    // If badgeId provided, update the badge with the new image URL
    if (badgeId) {
      await supabaseAdmin
        .from('badges')
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', badgeId)
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename
    })
  } catch (error) {
    console.error('Error uploading badge image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
