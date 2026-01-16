import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
}

export function Card({ children, className = '', hover = false, glow = false }: CardProps) {
  return (
    <div
      className={`
        bg-card rounded-xl border border-border p-4
        ${hover ? 'transition-all duration-200 hover:border-primary/50 hover:bg-card/80' : ''}
        ${glow ? 'glow' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-lg font-semibold text-foreground ${className}`}>
      {children}
    </h3>
  )
}

export function CardDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground mt-1 ${className}`}>
      {children}
    </p>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-border ${className}`}>
      {children}
    </div>
  )
}
