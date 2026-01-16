'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface User {
  id: string
  email: string
  display_name: string
  credits: number
  is_admin: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // New user form
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [credits, setCredits] = useState('1000')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function checkAdminAndFetchUsers() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        window.location.href = '/'
        return
      }

      setIsAdmin(true)

      // Fetch all users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      setUsers(usersData || [])
      setLoading(false)
    }

    checkAdminAndFetchUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')

    // Validate email
    if (!email.endsWith('@andrew.cmu.edu')) {
      setError('Email must be an @andrew.cmu.edu address')
      setCreating(false)
      return
    }

    const supabase = createClient()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      setError('A user with this email already exists')
      setCreating(false)
      return
    }

    // Create user profile directly (for manual user creation without auth)
    // Note: This creates a profile entry but the user will need to sign up through auth to actually log in
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        email: email,
        display_name: displayName || email.split('@')[0],
        credits: parseInt(credits) || 1000,
        is_admin: makeAdmin,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setCreating(false)
      return
    }

    // Add to users list
    if (newProfile) {
      setUsers([newProfile, ...users])
    }

    setSuccess(`User "${displayName || email}" created successfully! They will need to sign up with this email to access their account.`)
    setEmail('')
    setDisplayName('')
    setCredits('1000')
    setMakeAdmin(false)
    setCreating(false)
  }

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId)

    if (!error) {
      setUsers(users.map(u =>
        u.id === userId ? { ...u, is_admin: !currentStatus } : u
      ))
    }
  }

  const handleAdjustCredits = async (userId: string, adjustment: number) => {
    const supabase = createClient()
    const user = users.find(u => u.id === userId)
    if (!user) return

    const newCredits = Math.max(0, user.credits + adjustment)

    const { error } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', userId)

    if (!error) {
      setUsers(users.map(u =>
        u.id === userId ? { ...u, credits: newCredits } : u
      ))

      // Record transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: adjustment,
          type: adjustment > 0 ? 'monthly_bonus' : 'bet_placed',
          description: `Admin adjustment: ${adjustment > 0 ? '+' : ''}${adjustment} credits`,
        })
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-16">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 bg-muted rounded-full mb-4" />
              <div className="h-6 w-48 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage users and their credits</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add User'}
        </Button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>
              Add a new user to the platform. They will need to sign up with this email to access their account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    placeholder="andrew@andrew.cmu.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">Must be @andrew.cmu.edu</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Display Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Andrew Carnegie"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Starting Credits
                  </label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    min={0}
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makeAdmin}
                      onChange={(e) => setMakeAdmin(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">Make admin</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
                  {success}
                </div>
              )}

              <Button type="submit" loading={creating}>
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
          <CardDescription>
            View and manage all platform users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold">
                      {user.display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{user.display_name}</p>
                      {user.is_admin && <Badge variant="accent">Admin</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-accent font-mono font-medium">
                      {user.credits.toLocaleString()} credits
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdjustCredits(user.id, -100)}
                      title="Remove 100 credits"
                    >
                      -100
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdjustCredits(user.id, 100)}
                      title="Add 100 credits"
                    >
                      +100
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                    >
                      {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No users found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
