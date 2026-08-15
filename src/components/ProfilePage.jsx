import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertStack,
  Field,
  LoadingButton,
  PasswordField,
  inputClass,
} from './auth/fields'
import { ApiError, logout, updateCachedUser, useAuth } from '../lib/auth'
import { apiChangePassword, apiTelegramLink, apiTelegramStatus, apiTelegramUnlink, apiUpdateProfile } from '../lib/api'
import { useLang, useT } from '../i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

function formatDate(t, timestamp) {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(t === 'uz' ? 'uz-UZ' : t === 'ru' ? 'ru-RU' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function Avatar({ user, size = 'h-20 w-20', text = 'text-2xl' }) {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.full_name}
        className={size + ' shrink-0 rounded-2xl border border-border object-cover'}
      />
    )
  }
  return (
    <span
      className={
        size +
        ' flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-500 to-electric-500 ' +
        'font-display font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] ' +
        text
      }
      aria-hidden="true"
    >
      {(user?.full_name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-input px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-[14px] font-medium text-fg">{value || '—'}</p>
    </div>
  )
}

function TelegramSection({ t }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    apiTelegramStatus()
      .then((data) => alive && setStatus(data?.account ?? null))
      .catch(() => alive && setStatus(null))
    return () => {
      alive = false
    }
  }, [status?.telegram_user_id])

  useEffect(() => {
    if (!link) return
    const timer = setInterval(() => {
      apiTelegramStatus()
        .then((data) => {
          if (data?.account) {
            setStatus(data.account)
            setLink(null)
          }
        })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(timer)
  }, [link])

  async function handleLink() {
    setLoading(true)
    setError(null)
    try {
      const created = await apiTelegramLink()
      setLink(created)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null
      setError(code ? t(`auth.errors.${code}`) : t('auth.errors.network'))
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlink() {
    setLoading(true)
    setError(null)
    try {
      await apiTelegramUnlink()
      setStatus(null)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null
      setError(code ? t(`auth.errors.${code}`) : t('auth.errors.network'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="relative mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-fg">
          🔗 {t('profile.telegram.title')}
        </h2>
        {status?.telegram_user_id ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-300">
            ✅ {t('profile.telegram.linked')}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-card px-3 py-1 text-[12px] font-semibold text-muted">
            {t('profile.telegram.notLinked')}
          </span>
        )}
      </div>

      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted">
        {t('profile.telegram.hint')}
      </p>

      {error && <p className="mt-2 text-[12px] text-rose-300">{error}</p>}

      {status?.telegram_user_id ? (
        <div className="mt-3 rounded-xl border border-border bg-input px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
            {t('profile.telegram.account')}
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-fg">
            {status.telegram_username ? `@${status.telegram_username}` : status.telegram_user_id}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {t('profile.telegram.notificationsOn')}
          </p>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={loading}
            className="mt-3 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[12px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
          >
            {t('profile.telegram.unlink')}
          </button>
        </div>
      ) : link ? (
        <div className="mt-3 rounded-xl border border-electric-500/25 bg-electric-500/10 px-4 py-3">
          <p className="text-[12px] text-electric-200">{t('profile.telegram.codeHint')}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-border bg-card px-4 py-2 font-mono text-lg font-bold tracking-widest text-fg">
              {link.code}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-border bg-card px-4 py-2 text-[12px] font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
            >
              {copied ? '✅' : '📋'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {t('profile.telegram.expires')} {Math.round(link.expires_in_sec / 60)} {t('profile.telegram.minutes')}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLink}
          disabled={loading}
          className="mt-3 rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)] disabled:opacity-50"
        >
          {t('profile.telegram.linkButton')}
        </button>
      )}
    </div>
  )
}

export default function ProfilePage({ navigate }) {
  const t = useT()
  const { user } = useAuth()
  const lang = useLang()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [form, setForm] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarError, setAvatarError] = useState(null)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwLoading, setPwLoading] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name ?? '',
        phone: user.phone ?? '',
        email: user.email ?? '',
        date_of_birth: user.date_of_birth ?? '',
        gender: user.gender ?? '',
      })
    }
  }, [user])

  if (!user) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center px-4 pt-16">
        <p className="glass rounded-2xl px-6 py-4 text-sm text-muted">{t('auth.errors.session_expired')}</p>
      </div>
    )
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: null }))
  }

  function validate() {
    const errors = {}
    if (form.full_name?.trim().length < 2) errors.full_name = 'invalid_name'
    if (!EMAIL_RE.test(form.email?.trim() ?? '')) errors.email = 'invalid_email'
    if ((form.phone?.replace(/\D/g, '') ?? '').length < 9) errors.phone = 'invalid_phone'
    if (form.date_of_birth) {
      const dob = new Date(`${form.date_of_birth}T00:00:00Z`)
      if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) errors.date_of_birth = 'invalid_dob'
    }
    return errors
  }

  async function handleSave(event) {
    event.preventDefault()
    if (saving) return
    setError(null)
    setSuccess(null)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      const data = await apiUpdateProfile({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        avatar: avatarPreview ?? user.avatar ?? null,
      })
      updateCachedUser(data.user)
      setAvatarPreview(null)
      setEditing(false)
      setSuccess(t('profile.success.saved'))
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null
      setError(code ? t(`auth.errors.${code}`) : t('auth.errors.network'))
    } finally {
      setSaving(false)
    }
  }

  function handleAvatarFile(file) {
    setAvatarError(null)
    if (!file) return
    if (!AVATAR_TYPES.has(file.type)) {
      setAvatarError(t('profile.avatarErrorType'))
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(t('profile.avatarErrorSize'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
  }

  function removeAvatar() {
    setAvatarPreview(null)
    setAvatarError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function cancelEdit() {
    setEditing(false)
    setFieldErrors({})
    setAvatarPreview(null)
    setAvatarError(null)
    if (user) {
      setForm({
        full_name: user.full_name ?? '',
        phone: user.phone ?? '',
        email: user.email ?? '',
        date_of_birth: user.date_of_birth ?? '',
        gender: user.gender ?? '',
      })
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    if (pwLoading) return
    setError(null)
    setSuccess(null)
    const errors = {}
    if (!pw.current) errors.current = 'wrong_password'
    if (pw.next.length < 8) errors.next = 'password_too_short'
    if (pw.confirm !== pw.next) errors.confirm = 'passwords_mismatch'
    setPwErrors(errors)
    if (Object.keys(errors).length) return

    setPwLoading(true)
    try {
      await apiChangePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      setPwOpen(false)
      setSuccess(t('profile.success.passwordChanged'))
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null
      setError(code ? t(`auth.errors.${code}`) : t('auth.errors.network'))
    } finally {
      setPwLoading(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const genderLabel =
    form.gender === 'male' ? t('auth.male') : form.gender === 'female' ? t('auth.female') : form.gender === 'other' ? t('auth.other') : '—'
  const displayedAvatar = avatarPreview ?? user.avatar ?? null

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div
            className="pointer-events-none absolute -top-24 right-0 h-56 w-72 rounded-full blur-3xl"
            style={{ background: 'var(--blob-a)' }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              <Avatar user={displayedAvatar ? { ...user, avatar: displayedAvatar } : user} size="h-20 w-20" />
              {editing && (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-fg shadow-md transition-colors hover:bg-card-hover"
                    aria-label={t('profile.changeAvatar')}
                    title={t('profile.changeAvatar')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 20h16M4 20V10l6-6h8l2 2v14M4 20v-6m10-10v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                  />
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
                {t('profile.title')}
              </p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-semibold text-fg">
                {user.full_name}
              </h1>
              <p className="mt-1 truncate text-[13px] text-muted">{user.email}</p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)]"
                >
                  {t('profile.edit')}
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                {t('profile.logout')}
              </button>
            </div>
          </div>

          {editing && (
            <div className="relative mt-4 rounded-xl border border-electric-500/25 bg-electric-500/10 px-4 py-3">
              <p className="text-[11px] text-electric-300">{t('profile.uploadHint')}</p>
              {avatarError && <p className="mt-1 text-[11px] text-rose-300">{avatarError}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
                >
                  {t('profile.changeAvatar')}
                </button>
                {(displayedAvatar || avatarPreview != null) && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
                  >
                    {t('profile.removeAvatar')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="relative mt-6">
            <AlertStack error={error} success={success} />
          </div>

          {!editing ? (
            <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
              <InfoRow label={t('profile.fullName')} value={user.full_name} />
              <InfoRow label={t('profile.email')} value={user.email} />
              <InfoRow label={t('profile.phone')} value={user.phone} />
              <InfoRow
                label={t('profile.dateOfBirth')}
                value={form.date_of_birth ? formatDate(lang, new Date(`${form.date_of_birth}T00:00:00Z`).getTime()) : '—'}
              />
              <InfoRow label={t('profile.gender')} value={genderLabel} />
              <InfoRow label={t('profile.memberSince')} value={formatDate(lang, user.created_at)} />
            </div>
          ) : (
            <motion.form
              key="edit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSave}
              className="relative mt-6 flex flex-col gap-4"
              noValidate
            >
              <Field label={t('profile.fullName')} error={fieldErrors.full_name && t(`auth.errors.${fieldErrors.full_name}`)}>
                <input
                  type="text"
                  value={form.full_name ?? ''}
                  onChange={(e) => setField('full_name', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('profile.email')} error={fieldErrors.email && t(`auth.errors.${fieldErrors.email}`)}>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => setField('email', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('profile.phone')} error={fieldErrors.phone && t(`auth.errors.${fieldErrors.phone}`)}>
                  <input
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={(e) => setField('phone', e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('profile.dateOfBirth')} error={fieldErrors.date_of_birth && t(`auth.errors.${fieldErrors.date_of_birth}`)}>
                  <input
                    type="date"
                    value={form.date_of_birth ?? ''}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setField('date_of_birth', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('profile.gender')}>
                  <select
                    value={form.gender ?? ''}
                    onChange={(e) => setField('gender', e.target.value)}
                    className={inputClass + ' appearance-none'}
                  >
                    <option value="">{t('auth.genderPlaceholder')}</option>
                    <option value="male">{t('auth.male')}</option>
                    <option value="female">{t('auth.female')}</option>
                    <option value="other">{t('auth.other')}</option>
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <LoadingButton
                  loading={saving}
                  disabled={!form.full_name?.trim() || !form.email?.trim() || !form.phone?.trim()}
                  className="w-auto px-7"
                >
                  {t('profile.saveChanges')}
                </LoadingButton>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-full border border-border bg-card px-7 py-3 text-sm font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg disabled:opacity-50"
                >
                  {t('profile.cancel')}
                </button>
              </div>
            </motion.form>
          )}

          {/* Change password */}
          <div className="relative mt-8 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => {
                setPwOpen((v) => !v)
                setError(null)
                setSuccess(null)
              }}
              className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
            >
              {t('profile.changePassword')}
            </button>
            <AnimatePresence>
              {pwOpen && (
                <motion.form
                  key="pw"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleChangePassword}
                  className="overflow-hidden"
                  noValidate
                >
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <PasswordField
                      label={t('profile.currentPassword')}
                      value={pw.current}
                      onChange={(e) => {
                        setPw((p) => ({ ...p, current: e.target.value }))
                        setPwErrors((e2) => ({ ...e2, current: null }))
                      }}
                      autoComplete="current-password"
                      showLabel={t('auth.showPassword')}
                      hideLabel={t('auth.hidePassword')}
                      error={pwErrors.current && t(`auth.errors.${pwErrors.current}`)}
                    />
                    <div />
                    <PasswordField
                      label={t('profile.newPassword')}
                      value={pw.next}
                      onChange={(e) => {
                        setPw((p) => ({ ...p, next: e.target.value }))
                        setPwErrors((e2) => ({ ...e2, next: null }))
                      }}
                      autoComplete="new-password"
                      showLabel={t('auth.showPassword')}
                      hideLabel={t('auth.hidePassword')}
                      error={pwErrors.next && t(`auth.errors.${pwErrors.next}`)}
                    />
                    <PasswordField
                      label={t('profile.confirmNewPassword')}
                      value={pw.confirm}
                      onChange={(e) => {
                        setPw((p) => ({ ...p, confirm: e.target.value }))
                        setPwErrors((e2) => ({ ...e2, confirm: null }))
                      }}
                      autoComplete="new-password"
                      showLabel={t('auth.showPassword')}
                      hideLabel={t('auth.hidePassword')}
                      error={pwErrors.confirm && t(`auth.errors.${pwErrors.confirm}`)}
                    />
                  </div>
                  <div className="mt-4">
                    <LoadingButton
                      loading={pwLoading}
                      disabled={!pw.current || pw.next.length < 8 || pw.confirm !== pw.next}
                      className="w-auto px-7"
                    >
                      {t('profile.updatePassword')}
                    </LoadingButton>
                  </div>
                </motion.form>
              )}
              </AnimatePresence>
            </div>
          </div>

          <TelegramSection t={t} />
        </motion.section>
      </div>
    </div>
  )
}
