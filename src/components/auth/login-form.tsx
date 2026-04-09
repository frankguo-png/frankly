'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

function parseAuthError(message: string): string {
  if (message === 'Invalid login credentials') {
    return 'Incorrect email or password. Please try again.'
  }
  if (
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('failed to fetch')
  ) {
    return 'Unable to connect. Please check your internet connection.'
  }
  return message
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(parseAuthError(authError.message))
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Unable to connect. Please check your internet connection.')
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-medium text-[#7b8fa3]">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="border-[rgba(255,255,255,0.06)] bg-[#0a1628]/60 text-[#e8edf4] placeholder:text-[#6b7f94] focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 focus:bg-[#0a1628]/80 transition-all duration-200"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-medium text-[#7b8fa3]">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="border-[rgba(255,255,255,0.06)] bg-[#0a1628]/60 text-[#e8edf4] placeholder:text-[#6b7f94] focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 focus:bg-[#0a1628]/80 transition-all duration-200 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6d82] hover:text-[#e8edf4] transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => toast.info('Password reset coming soon')}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Forgot password?
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 hover:shadow-[0_0_24px_-3px_rgba(59,130,246,0.5)] transition-all duration-200 border-0"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin-slow h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Signing in...
          </span>
        ) : (
          'Sign in'
        )}
      </Button>
      <p className="text-center text-xs text-[#7b8fa3]">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => toast.info('Sign up coming soon')}
          className="text-blue-400 hover:text-blue-300"
        >
          Sign up
        </button>
      </p>
    </form>
  )
}
