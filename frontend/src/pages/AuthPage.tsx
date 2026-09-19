import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrainCircuit, Loader2, Mail, Lock, KeyRound, Eye, EyeOff } from 'lucide-react'
import api from '../api/client'

type Step = 'login' | 'register_email' | 'register_otp'

function validatePassword(password: string): string {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.'
  if (!/\d/.test(password)) return 'Password must contain at least one number.'
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character.'
  return ''
}

export default function AuthPage() {
  const [step, setStep] = useState<Step>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append('username', email.toLowerCase()); form.append('password', password)
      const { data } = await api.post('/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      login(data.access_token, email); navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials.')
    } finally { setLoading(false) }
  }

  const handleSendOtp = async () => {
    setError('')
    if (!email.trim()) return setError('Please enter your email.')
    const pwError = validatePassword(password)
    if (pwError) return setError(pwError)
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await api.post('/auth/send-otp', { email: email.trim().toLowerCase() })
      setSuccess(`OTP sent to ${email}. Check your inbox.`)
      setStep('register_otp')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send OTP.')
    } finally { setLoading(false) }
  }

  const handleVerifyOtp = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(), otp: otp.trim(), password,
      })
      login(data.access_token, email); navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP.')
    } finally { setLoading(false) }
  }

  const handleResendOtp = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      await api.post('/auth/send-otp', { email: email.trim().toLowerCase() })
      setSuccess('New OTP sent. Check your inbox.')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend OTP.')
    } finally { setLoading(false) }
  }

  const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-10 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"

  const PasswordStrengthBar = ({ password }: { password: string }) => {
    const rules = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password),
    ]
    const metCount = rules.filter(Boolean).length
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500']
    return (
      <div className="mt-2 flex gap-1">
        {rules.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < metCount ? colors[metCount - 1] : 'bg-slate-700'
          }`} />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-slate-900 border-r border-slate-800 p-12">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-indigo-400" size={24} />
          <span className="text-white font-bold text-xl" style={{ fontFamily: 'var(--font-display)' }}>
            Career<span className="text-indigo-400">AI</span>
          </span>
        </div>

        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Your resume,<br />
            <span className="text-indigo-400">evaluated like</span><br />
            a recruiter would.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            Industry-specific scoring, ATS gap detection, and brutally honest feedback powered by AI.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { label: 'Score Accuracy', value: 'Role-Specific' },
              { label: 'Feedback Type', value: 'LLM-Powered' },
              { label: 'Skill Detection', value: 'Section-Aware' },
              { label: 'Analysis Speed', value: '< 3 seconds' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-500 text-xs">{label}</p>
                <p className="text-white font-semibold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-sm">Built for students & engineers who take their career seriously.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md fade-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <BrainCircuit className="text-indigo-400" size={22} />
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
              Career<span className="text-indigo-400">AI</span>
            </span>
          </div>

          {/* LOGIN */}
          {step === 'login' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                Welcome back
              </h2>
              <p className="text-slate-400 text-sm mb-8">
                Don't have an account?{' '}
                <button onClick={() => { setStep('register_email'); setError('') }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Sign up
                </button>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Email</label>
                  <div className="relative mt-1.5">
                    <Mail size={15} className="absolute left-3 top-3.5 text-slate-500" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Password</label>
                  <div className="relative mt-1.5">
                    <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      placeholder="••••••••"
                      className={inputClass} />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>}
                <button onClick={handleLogin} disabled={loading || !email || !password}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Sign In
                </button>
              </div>
            </>
          )}

          {/* REGISTER STEP 1 */}
          {step === 'register_email' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                Create account
              </h2>
              <p className="text-slate-400 text-sm mb-8">
                Already have an account?{' '}
                <button onClick={() => { setStep('login'); setError('') }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Sign in
                </button>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Email</label>
                  <div className="relative mt-1.5">
                    <Mail size={15} className="absolute left-3 top-3.5 text-slate-500" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Password</label>
                  <div className="relative mt-1.5">
                    <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 chars, upper, lower, number, symbol"
                      className={inputClass} />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password && <PasswordStrengthBar password={password} />}
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Confirm Password</label>
                  <div className="relative mt-1.5">
                    <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                      placeholder="••••••••"
                      className={inputClass} />
                    <button type="button" onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>}
                <button onClick={handleSendOtp} disabled={loading || !email || !password || !confirmPassword}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending OTP...</> : 'Send Verification Code'}
                </button>
              </div>
            </>
          )}

          {/* REGISTER STEP 2 — OTP */}
          {step === 'register_otp' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <KeyRound size={18} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    Verify your email
                  </h2>
                  <p className="text-slate-400 text-sm">Code sent to <span className="text-indigo-400">{email}</span></p>
                </div>
              </div>
              {success && (
                <div className="mb-4 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5">
                  {success}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">6-Digit Code</label>
                  <input type="text" value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                    placeholder="000000" maxLength={6}
                    className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-600 text-3xl tracking-[1rem] font-mono text-center focus:outline-none focus:border-indigo-500 transition-colors" />
                  <p className="text-slate-500 text-xs mt-2 text-center">Code expires in 10 minutes</p>
                </div>
                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>}
                <button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Create Account'}
                </button>
                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setStep('register_email'); setError(''); setOtp('') }}
                    className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    ← Change email
                  </button>
                  <button onClick={handleResendOtp} disabled={loading}
                    className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors disabled:opacity-50">
                    Resend code
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}