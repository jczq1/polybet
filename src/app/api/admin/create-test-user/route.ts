import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, displayName, credits } = await request.json()

    if (!email || !displayName) {
      return NextResponse.json({ error: 'Email and display name are required' }, { status: 400 })
    }

    // Verify the requesting user is an admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Only admins can create test users' }, { status: 403 })
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create auth user with a random password
    const tempPassword = `TestUser_${Math.random().toString(36).slice(2)}!`

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm the email
      user_metadata: { display_name: displayName, is_test_user: true }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Update the profile with the correct credits (profile is auto-created by trigger)
    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: displayName,
        credits: credits || 1000
      })
      .eq('id', authUser.user.id)

    if (updateError) {
      // Profile might not exist yet, try to create it
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: authUser.user.id,
          email,
          display_name: displayName,
          credits: credits || 1000,
          is_admin: false
        })
    }

    // Check if signup_bonus transaction already exists (from trigger)
    const { data: existingBonus } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('user_id', authUser.user.id)
      .eq('type', 'signup_bonus')
      .single()

    if (existingBonus) {
      // Update existing signup bonus to match the requested credits
      await supabaseAdmin
        .from('transactions')
        .update({ amount: credits || 1000 })
        .eq('id', existingBonus.id)
    } else {
      // Record signup bonus transaction only if it doesn't exist
      await supabaseAdmin.from('transactions').insert({
        user_id: authUser.user.id,
        amount: credits || 1000,
        type: 'signup_bonus',
        description: 'Test user signup bonus'
      })
    }

    return NextResponse.json({
      success: true,
      userId: authUser.user.id,
      message: `Test user created. Login: ${email} / ${tempPassword}`
    })

  } catch (error) {
    console.error('Error creating test user:', error)
    return NextResponse.json({ error: 'Failed to create test user' }, { status: 500 })
  }
}
