import { useState } from 'react'
import { motion } from 'framer-motion'
import AuthShell from './auth/AuthShell'
import {
  AlertStack,
  Field,
  LoadingButton,
  PasswordField,
  inputClass,
} from './auth/fields'
import { ApiError, register } from '../lib/auth'
import { useT } from '../i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function redirectFromUrl() {
  try {
    const param = new URLSearchParams(window.location.search).get('redirect')
    if (param && param.startsWith('/')) return param
  } catch {
    // Ignore malformed redirect params.
  }
  return '/cabinet'
}

function errorText(t, code) {
  const key = code ? `auth.errors.${code}` : 'auth.errors.unknown'
  const mapped = t(key)
  return mapped && !mapped.startsWith('auth.errors') ? mapped : t('auth.errors.unknown')
}

export default function RegisterPage({ navigate, onAuthed = null }) {
  const t = useT()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    gender: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const redirect = redirectFromUrl()

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: null }))
  }

  function validate() {
    const errors = {}
    if (form.full_name.trim().length < 2) errors.full_name = 'invalid_name'
    if (!EMAIL_RE.test(form.email.trim())) errors.email = 'invalid_email'
    if (form.phone.replace(/\D/g, '').length < 9) errors.phone = 'invalid_phone'
    if (form.password.length < 8) errors.password = 'password_too_short'
    if (form.confirm_password !== form.password) errors.confirm_password = 'passwords_mismatch'
    if (form.date_of_birth) {
      const dob = new Date(`${form.date_of_birth}T00:00:00Z`)
      if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) errors.date_of_birth = 'invalid_dob'
    }
    if (form.gender && !['male', 'female', 'other'].includes(form.gender)) {
      errors.gender = 'invalid_gender'
    }
    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setError(null)
    setSuccess(null)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setLoading(true)
    try {
      await register({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
      })
      setSuccess(t('auth.success.accountCreated'))
      onAuthed?.()
      setTimeout(() => navigate(redirect), 600)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null
      if (code) {
        setError(errorText(t, code))
      } else {
        setError(t('auth.errors.network'))
      }
    } finally {
      setLoading(false)
    }
  }

  const goLogin = (event) => {
    event.preventDefault()
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`)
  }

  return (
    <AuthShell
      eyebrow="MedQueue"
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
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

      <motion.form
        key="register"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit}
        className="mt-6 flex flex-col gap-4"
        noValidate
      >
        <Field label={t('auth.fullName')} error={fieldErrors.full_name && t(`auth.errors.${fieldErrors.full_name}`)}>
          <input
            type="text"
            name="full_name"
            value={form.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            placeholder="Azizbek Karimov"
            autoComplete="name"
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field label={t('auth.phone')} error={fieldErrors.phone && t(`auth.errors.${fieldErrors.phone}`)}>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+998 90 123 45 67"
            autoComplete="tel"
            className={inputClass}
          />
        </Field>

        <Field label={t('auth.email')} error={fieldErrors.email && t(`auth.errors.${fieldErrors.email}`)}>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
          />
        </Field>

        <PasswordField
          label={t('auth.password')}
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          placeholder={t('auth.password')}
          autoComplete="new-password"
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          error={fieldErrors.password && t(`auth.errors.${fieldErrors.password}`)}
        />

        <PasswordField
          label={t('auth.confirmPassword')}
          value={form.confirm_password}
          onChange={(e) => setField('confirm_password', e.target.value)}
          placeholder={t('auth.confirmPassword')}
          autoComplete="new-password"
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          error={fieldErrors.confirm_password && t(`auth.errors.${fieldErrors.confirm_password}`)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('auth.dateOfBirth')}
            error={fieldErrors.date_of_birth && t(`auth.errors.${fieldErrors.date_of_birth}`)}
            hint={t('auth.optional')}
          >
            <input
              type="date"
              name="date_of_birth"
              value={form.date_of_birth}
              onChange={(e) => setField('date_of_birth', e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </Field>

          <Field
            label={t('auth.gender')}
            error={fieldErrors.gender && t(`auth.errors.${fieldErrors.gender}`)}
            hint={t('auth.optional')}
          >
            <select
              name="gender"
              value={form.gender}
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

        <LoadingButton loading={loading} disabled={!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || !form.password}>
          {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
        </LoadingButton>

        <p className="mt-1 text-center text-[13px] text-muted">
          {t('auth.alreadyHaveAccount')}{' '}
          <a
            href="/login"
            onClick={goLogin}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {t('auth.loginNow')}
          </a>
        </p>
      </motion.form>
    </AuthShell>
  )
}
