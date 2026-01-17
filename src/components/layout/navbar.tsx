'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(data)
      }
      setLoading(false)
    }

    getProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getProfile()
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/markets', label: 'Markets' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Omen Logo */}
          <Link href="/" className="flex items-center space-x-2.5">
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              {/* Outer pixelated border - top */}
              <rect x="8" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="16" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="24" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="32" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="40" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="48" y="4" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Outer pixelated border - bottom */}
              <rect x="8" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="16" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="24" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="32" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="40" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="48" y="56" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Outer pixelated border - left */}
              <rect x="4" y="8" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="16" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="24" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="32" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="40" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="4" y="48" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Outer pixelated border - right */}
              <rect x="56" y="8" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="16" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="24" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="32" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="40" width="4" height="4" fill="currentColor" className="text-primary"/>
              <rect x="56" y="48" width="4" height="4" fill="currentColor" className="text-primary"/>
              {/* Inner square */}
              <rect x="12" y="12" width="40" height="40" fill="currentColor" className="text-primary"/>
              {/* Center circle (cutout effect using background color) */}
              <circle cx="32" cy="32" r="10" fill="currentColor" className="text-background"/>
              <circle cx="32" cy="32" r="6" fill="currentColor" className="text-primary"/>
            </svg>
            <span className="font-bold text-lg text-primary tracking-wide">OMEN</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Admin
              </Link>
            )}
          </div>

          {/* User Section */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
            ) : profile ? (
              <>
                {/* Credits Display */}
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                  </svg>
                  <span className="text-sm font-medium text-foreground">
                    {profile.credits.toLocaleString()}
                  </span>
                </div>

                {/* Profile Dropdown */}
                <div className="flex items-center space-x-2">
                  <Link
                    href="/profile"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive('/profile')
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {profile.display_name}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    Sign out
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="primary" size="sm">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden border-t border-border px-4 py-2">
        <div className="flex items-center space-x-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {profile?.is_admin && (
            <Link
              href="/admin"
              className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Admin
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
