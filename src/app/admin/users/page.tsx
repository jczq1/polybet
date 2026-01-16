'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const supabase = createClient()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newCredits, setNewCredits] = useState('1000')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit credits
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editCredits, setEditCredits] = useState('')

  // Delete confirmation
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  useEffect(() => {
    checkAdminAndLoadUsers()
  }, [])

  async function checkAdminAndLoadUsers() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      router.push('/')
      return
    }

    setIsAdmin(true)
    loadUsers()
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setUsers(data)
    }
    setLoading(false)
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError('')

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            display_name: newDisplayName,
          }
        }
      })

      if (authError) {
        setAddError(authError.message)
        setAddLoading(false)
        return
      }

      if (authData.user) {
        // Update profile with custom credits
        await supabase
          .from('profiles')
          .update({
            credits: parseInt(newCredits) || 1000,
            display_name: newDisplayName
          })
          .eq('id', authData.user.id)
      }

      // Reset form and reload
      setNewEmail('')
      setNewDisplayName('')
      setNewPassword('')
      setNewCredits('1000')
      setShowAddForm(false)
      loadUsers()
    } catch (err) {
      setAddError('Failed to create user')
    }

    setAddLoading(false)
  }

  async function handleUpdateCredits(userId: string) {
    const credits = parseInt(editCredits)
    if (isNaN(credits) || credits < 0) return

    await supabase
      .from('profiles')
      .update({ credits })
      .eq('id', userId)

    setEditingUserId(null)
    setEditCredits('')
    loadUsers()
  }

  async function handleDeleteUser(userId: string) {
    // Delete profile (auth user might need admin SDK)
    await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    setDeletingUserId(null)
    loadUsers()
  }

  async function handleToggleAdmin(userId: string, currentStatus: boolean) {
    await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId)

    loadUsers()
  }

  if (loading || !isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          </div>
          <p className="text-muted-foreground">Add, edit, and manage users</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </>
          )}
        </Button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New User</CardTitle>
            <CardDescription>Create a new user account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                  <Input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Starting TMX</label>
                  <Input
                    type="number"
                    value={newCredits}
                    onChange={(e) => setNewCredits(e.target.value)}
                    placeholder="1000"
                    min={0}
                  />
                </div>
              </div>
              {addError && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {addError}
                </div>
              )}
              <Button type="submit" loading={addLoading}>
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
          <CardDescription>Manage user accounts and balances</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {user.display_name?.charAt(0)?.toUpperCase() || '?'}
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
                    {/* Credits Display/Edit */}
                    {editingUserId === user.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editCredits}
                          onChange={(e) => setEditCredits(e.target.value)}
                          className="w-24"
                          min={0}
                        />
                        <Button size="sm" onClick={() => handleUpdateCredits(user.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUserId(user.id)
                          setEditCredits(String(user.credits))
                        }}
                        className="text-right hover:bg-muted/50 px-3 py-1 rounded transition-colors"
                      >
                        <p className="font-mono text-accent font-medium">
                          {user.credits.toLocaleString()} TMX
                        </p>
                        <p className="text-xs text-muted-foreground">Click to edit</p>
                      </button>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                      >
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </Button>

                      {deletingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-error border-error"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingUserId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error hover:bg-error/10"
                          onClick={() => setDeletingUserId(user.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No users found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
