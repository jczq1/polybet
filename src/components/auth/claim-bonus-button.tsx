'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface ClaimBonusButtonProps {
  canClaim: boolean
  userId: string
}

export function ClaimBonusButton({ canClaim, userId }: ClaimBonusButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)

  const handleClaim = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .rpc('claim_monthly_bonus', { user_uuid: userId })

    if (!error && data) {
      setClaimed(true)
      router.refresh()
    }

    setLoading(false)
  }

  if (claimed) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-success font-medium">+200 TMX claimed!</p>
      </div>
    )
  }

  return (
    <div className="text-center">
      {canClaim ? (
        <>
          <div className="text-4xl font-bold text-accent mb-4">+200</div>
          <Button onClick={handleClaim} loading={loading} className="w-full">
            Claim Bonus
          </Button>
        </>
      ) : (
        <>
          <div className="text-4xl font-bold text-muted-foreground mb-4">+200</div>
          <Button disabled className="w-full">
            Already Claimed
          </Button>
        </>
      )}
    </div>
  )
}
