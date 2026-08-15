import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import AuthShell from './auth/AuthShell'
import {
  AlertStack,
  Checkbox,
  Field,
  LoadingButton,
  PasswordField,
  inputClass,
} from './auth/fields'
import { ApiError, login } from '../lib/auth'
import { apiForgotPassword, apiResetPassword } from '../lib/api'
import { useT } from '../i18n'

function redirectFromUrl() {
  try {
    const param = new URLSearchParams(window.location.search).get('redirect')
    if (param && param.startsWith('/')) return param
  } catch {
    // Ignore malformed redirect params.
  }
  return '/cabinet'
}

function authErrorMessage(t, err) {
  const code = err instanceof ApiError ? err.code : null
  const key = code ? `auth.errors.${code}` : 'auth.errors.unknown'
  const mapped = t(key)
  return mapped && !mapped.startsWith('auth.errors') ? mapped : t('auth.errors.unknown')
}

export default function LoginPage({ navigate, onAuthed = null }) {
  const t = useT()
  const [mode, setMode] = useState('login') // 'login' | 'forgot' | 'reset'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('mode')
    if (param === 'forgot') setMode('forgot')
  }, [])

  const redirect = redirectFromUrl()

  async function handleLogin(event) {
    event.preventDefault()
    if (loading) return
    setError(null)
    setSuccess(null)
    if (!identifier.trim() || !password) {
      setError(t('auth.errors.unknown'))
      return
    }
    setLoading(true)
    try {
      await login(identifier.trim(), password, remember)
      setSuccess(t('auth.welcomeBack'))
      onAuthed?.()
      setTimeout(() => navigate(redirect), 400)
    } catch (err) {
      setError(authErrorMessage(t, err))
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(event) {
    event.preventDefault()
    if (loading) return
    setError(null)
    setSuccess(null)
    if (!identifier.trim()) {
      setError(t('auth.errors.invalid_email'))
      return
    }
    setLoading(true)
    try {
      const data = await apiForgotPassword(identifier.trim())
      setSuccess(t('auth.success.resetSent'))
      setResetToken(data.reset_token ?? '')
      if (data.reset_token) setMode('reset')
    } catch (err) {
      setError(authErrorMessage(t, err))
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(event) {
    event.preventDefault()
    if (loading) return
    setError(null)
    setSuccess(null)
    if (!resetToken.trim()) return setError(t('auth.errors.invalid_token'))
    if (newPassword.length < 8) return setError(t('auth.errors.password_too_short'))
    setLoading(true)
    try {
      await apiResetPassword(resetToken.trim(), newPassword)
      setSuccess(t('auth.success.passwordReset'))
      setMode('login')
      setPassword('')
    } catch (err) {
      setError(authErrorMessage(t, err))
    } finally {
      setLoading(false)
    }
  }

  const goRegister = (event) => {
    event.preventDefault()
    navigate(`/register?redirect=${encodeURIComponent(redirect)}`)
  }

  return (
    <AuthShell
      eyebrow="MedQueue"
      title={mode === 'login' ? t('auth.loginTitle') : t('auth.forgotPasswordTitle')}
      subtitle={mode === 'login' ? t('auth.loginSubtitle') : t('auth.forgotPasswordHint')}
      footer={
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
          className="font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          ← {t('nav.home')}
        </a>
      }
    >
      <AlertStack error={error} success={success} />

      {mode === 'login' && (
        <motion.form
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onSubmit={handleLogin}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          <Field label={t('auth.emailOrPhone')}>
            <input
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="+998 90 123 45 67"
              autoComplete="username"
              autoFocus
              className={inputClass}
            />
          </Field>

          <PasswordField
            label={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            autoComplete="current-password"
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />

          <div className="flex items-center justify-between gap-3">
            <Checkbox
              label={t('auth.remember')}
              checked={remember}
              onChange={setRemember}
            />
            <button
              type="button"
              onClick={() => {
                setError(null)
                setSuccess(null)
                setMode('forgot')
              }}
              className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>

          <LoadingButton loading={loading} disabled={!identifier.trim() || !password}>
            {t('auth.login')}
          </LoadingButton>

          <p className="mt-1 text-center text-[13px] text-muted">
            {t('auth.noAccount')}{' '}
            <a
              href="/register"
              onClick={goRegister}
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              {t('auth.register')}
            </a>
          </p>
        </motion.form>
      )}

      {mode === 'forgot' && (
        <motion.form
          key="forgot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onSubmit={handleForgot}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          <Field label={t('auth.email')}>
            <input
              type="text"
              name="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className={inputClass}
            />
          </Field>
          <LoadingButton loading={loading} disabled={!identifier.trim()}>
            {loading ? t('auth.sending') : t('auth.resetPassword')}
          </LoadingButton>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setSuccess(null)
              setMode('login')
            }}
            className="text-center text-[13px] font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            {t('auth.backToLogin')}
          </button>
        </motion.form>
      )}

      {mode === 'reset' && (
        <motion.form
          key="reset"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onSubmit={handleReset}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          {resetToken && (
            <div className="rounded-xl border border-electric-500/25 bg-electric-500/10 px-4 py-3 text-[11px] leading-relaxed text-electric-300">
              {t('auth.resetTokenLabel')}:
              <code className="mt-0.5 block break-all font-mono text-[11px] text-fg">{resetToken}</code>
            </div>
          )}
          <Field label={t('auth.resetTokenLabel')}>
            <input
              type="text"
              name="token"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              className={inputClass}
            />
          </Field>
          <PasswordField
            label={t('auth.resetNewPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
          <LoadingButton loading={loading} disabled={!resetToken.trim() || newPassword.length < 8}>
            {t('auth.resetPassword')}
          </LoadingButton>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setSuccess(null)
              setMode('login')
            }}
            className="text-center text-[13px] font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            {t('auth.backToLogin')}
          </button>
        </motion.form>
      )}
    </AuthShell>
  )
}
