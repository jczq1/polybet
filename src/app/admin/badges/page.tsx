'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  image_url: string | null
  condition_type: string
  threshold: number
  is_active: boolean
  sort_order: number
  created_at: string
}

const CONDITION_TYPES = [
  { value: 'win_streak', label: 'Win Streak', description: 'Consecutive wins >= threshold' },
  { value: 'lose_streak', label: 'Lose Streak', description: 'Consecutive losses >= threshold' },
  { value: 'total_bets', label: 'Total Bets', description: 'Lifetime bets >= threshold' },
  { value: 'all_in_win', label: 'All-In Win', description: 'Bet 100% balance and won' },
  { value: 'all_in_lose', label: 'All-In Lose', description: 'Bet 100% balance and lost' },
  { value: 'leaderboard_rank', label: 'Leaderboard Rank', description: 'Achieved rank <= threshold' },
  { value: 'hold_duration_win', label: 'Hold Duration Win', description: 'Held >= threshold days and won' },
  { value: 'low_probability_win', label: 'Low Probability Win', description: 'Won with < threshold% probability' },
  { value: 'minority_win', label: 'Minority Win', description: 'Won with < threshold% of pool' },
  { value: 'single_bet_amount', label: 'Single Bet Amount', description: 'Made bet >= threshold credits' },
  { value: 'first_bettor_count', label: 'First Bettor Count', description: 'First to bet on >= threshold markets' },
]

export default function AdminBadgesPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '🏆',
    image_url: '',
    condition_type: 'total_bets',
    threshold: 1,
    is_active: true,
    sort_order: 0
  })

  useEffect(() => {
    fetchBadges()
  }, [])

  const fetchBadges = async () => {
    try {
      const response = await fetch('/api/admin/badges')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin')
          return
        }
        throw new Error('Failed to fetch badges')
      }
      const data = await response.json()
      setBadges(data.badges || [])
    } catch (err) {
      setError('Failed to load badges')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const url = editingBadge
        ? `/api/admin/badges/${editingBadge.id}`
        : '/api/admin/badges'

      const response = await fetch(url, {
        method: editingBadge ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image_url: formData.image_url || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save badge')
      }

      setSuccess(editingBadge ? 'Badge updated!' : 'Badge created!')
      resetForm()
      fetchBadges()
    } catch (err: any) {
      setError(err.message || 'Failed to save badge')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (badge: Badge) => {
    if (!confirm(`Are you sure you want to delete "${badge.name}"? This will also remove it from any users who have earned it.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/badges/${badge.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete badge')
      }

      setSuccess('Badge deleted!')
      fetchBadges()
    } catch (err) {
      setError('Failed to delete badge')
    }
  }

  const handleEdit = (badge: Badge) => {
    setEditingBadge(badge)
    setFormData({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      image_url: badge.image_url || '',
      condition_type: badge.condition_type,
      threshold: badge.threshold,
      is_active: badge.is_active,
      sort_order: badge.sort_order
    })
    setShowForm(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      if (editingBadge) {
        formDataUpload.append('badgeId', editingBadge.id)
      }

      const response = await fetch('/api/admin/badges/upload', {
        method: 'POST',
        body: formDataUpload
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image')
      }

      setFormData(prev => ({ ...prev, image_url: data.url }))
      setSuccess('Image uploaded!')
    } catch (err: any) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const resetForm = () => {
    setEditingBadge(null)
    setShowForm(false)
    setFormData({
      name: '',
      description: '',
      icon: '🏆',
      image_url: '',
      condition_type: 'total_bets',
      threshold: 1,
      is_active: true,
      sort_order: 0
    })
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-muted rounded mb-4" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Badge Management</h1>
            <p className="text-muted-foreground">Create and manage achievement badges</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true) }}>
            + New Badge
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          {success}
        </div>
      )}

      {/* Badge Form */}
      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{editingBadge ? 'Edit Badge' : 'Create New Badge'}</CardTitle>
            <CardDescription>
              {editingBadge ? 'Update the badge details' : 'Add a new achievement badge'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Insider Trader"
                    required
                  />
                </div>

                {/* Icon (emoji) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Icon (Emoji)</label>
                  <Input
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="🏆"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used if no image is uploaded</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description *</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Make 5 correct bets in a row"
                  required
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Custom Image (Optional)</label>
                <div className="flex items-center gap-4">
                  {formData.image_url && (
                    <div className="relative">
                      <img
                        src={formData.image_url}
                        alt="Badge preview"
                        className="w-16 h-16 object-contain rounded border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-error text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Uploading...' : 'Upload Image'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, WebP, or SVG. Max 2MB.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Condition Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Condition Type *</label>
                  <select
                    value={formData.condition_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                    required
                  >
                    {CONDITION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {CONDITION_TYPES.find(t => t.value === formData.condition_type)?.description}
                  </p>
                </div>

                {/* Threshold */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Threshold</label>
                  <Input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, threshold: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Sort Order</label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-border"
                />
                <label htmlFor="is_active" className="text-sm text-foreground">Active (can be earned)</label>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : (editingBadge ? 'Update Badge' : 'Create Badge')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Badges List */}
      <Card>
        <CardHeader>
          <CardTitle>All Badges ({badges.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No badges created yet. Click "New Badge" to create one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Badge</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Condition</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Threshold</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Order</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {badges.map((badge) => (
                    <tr key={badge.id} className="border-b border-border/50 hover:bg-secondary/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {badge.image_url ? (
                            <img
                              src={badge.image_url}
                              alt={badge.name}
                              className="w-10 h-10 object-contain"
                            />
                          ) : (
                            <span className="text-3xl">{badge.icon}</span>
                          )}
                          <div>
                            <p className="font-medium text-foreground">{badge.name}</p>
                            <p className="text-xs text-muted-foreground">{badge.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-foreground">
                          {CONDITION_TYPES.find(t => t.value === badge.condition_type)?.label || badge.condition_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-foreground">{badge.threshold}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          badge.is_active
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {badge.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">{badge.sort_order}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(badge)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-error hover:text-error"
                            onClick={() => handleDelete(badge)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
