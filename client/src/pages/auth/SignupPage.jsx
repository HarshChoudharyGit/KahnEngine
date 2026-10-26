import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'

const inputClassName =
  'mt-2 h-12 w-full rounded-lg border border-[#8e7139]/35 bg-[#100d0a] px-3.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#766b59] focus:border-[#d4ad58]/80 focus:ring-2 focus:ring-[#d4ad58]/10'

function SignupPage({ onNavigate }) {
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    if (formData.get('password') !== formData.get('confirmPassword')) {
      setNotice('Those passwords don’t match. Please check and try again.')
      return
    }

    setNotice('Sign-up is not connected yet. Connect an authentication provider to continue.')
  }

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b28e4a]">
          Start your journey
        </p>
        <h2 className="font-display text-3xl text-[#f0e5c9]">Create your account</h2>
        <p className="mt-2 text-sm text-[#a9997b]">Set up your workspace in just a moment.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-xs font-medium text-[#c9b991]">
          Your name
          <input
            autoComplete="name"
            className={inputClassName}
            name="name"
            placeholder="How should we call you?"
            required
          />
        </label>

        <label className="block text-xs font-medium text-[#c9b991]">
          Email address
          <span className="relative block">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#88795e]" />
            <input
              autoComplete="email"
              className={`${inputClassName} pl-10`}
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </span>
        </label>

        <label className="block text-xs font-medium text-[#c9b991]">
          Password
          <span className="relative block">
            <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#88795e]" />
            <input
              autoComplete="new-password"
              className={`${inputClassName} pl-10 pr-11`}
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type={showPassword ? 'text' : 'password'}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#88795e] transition hover:text-[#f0d58e] focus-visible:outline-2 focus-visible:outline-[#d4ad58]"
            >
              {showPassword
                ? <EyeOff aria-hidden="true" className="h-4 w-4" />
                : <Eye aria-hidden="true" className="h-4 w-4" />}
            </button>
          </span>
        </label>

        <label className="block text-xs font-medium text-[#c9b991]">
          Confirm password
          <input
            autoComplete="new-password"
            className={inputClassName}
            name="confirmPassword"
            placeholder="Enter your password again"
            required
            type={showPassword ? 'text' : 'password'}
          />
        </label>

        <label className="flex items-start gap-2.5 pt-1 text-xs leading-5 text-[#a9997b]">
          <input
            className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#c69b45]"
            name="terms"
            required
            type="checkbox"
          />
          <span>
            I agree to the <a href="#terms" className="text-[#d4ad58] hover:text-[#f0d58e]">Terms of Service</a> and{' '}
            <a href="#privacy" className="text-[#d4ad58] hover:text-[#f0d58e]">Privacy Policy</a>.
          </span>
        </label>

        {notice && (
          <p role="status" className="rounded-lg border border-[#8e7139]/30 bg-[#100d0a] px-3.5 py-3 text-xs leading-5 text-[#d4ad58]">
            {notice}
          </p>
        )}

        <button
          type="submit"
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#c69b45] px-4 text-sm font-semibold text-[#21170c] shadow-[0_8px_24px_rgba(198,155,69,0.12)] transition hover:bg-[#dfb95f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4ad58]"
        >
          Create your account
          <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#9d9076]">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="font-medium text-[#d4ad58] transition hover:text-[#f0d58e]"
        >
          Sign in
        </button>
      </p>
    </>
  )
}

export default SignupPage
