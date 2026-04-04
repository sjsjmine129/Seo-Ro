'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

const UNVERIFIED_EMAIL_MESSAGE =
  '이메일 인증이 되지 않은 계정입니다. 이메일 인증을 해주세요.'

function isUnverifiedEmailError(error: { message: string; code?: string }): boolean {
  const code = error.code?.toLowerCase()
  const msg = error.message.toLowerCase()
  return (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('email address not confirmed')
  )
}

/** Map Supabase Auth English messages to Korean for the login UI. */
function mapLoginErrorToKorean(error: { message: string; code?: string }): string {
  const msg = error.message.toLowerCase()
  const code = (error.code ?? '').toLowerCase()

  if (
    msg.includes('invalid login credentials') ||
    code === 'invalid_credentials' ||
    msg.includes('invalid credentials')
  ) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }

  if (
    msg.includes('invalid email') ||
    msg.includes('email format') ||
    msg.includes('valid email') ||
    msg.includes('unable to validate email') ||
    msg.includes('malformed') ||
    code === 'validation_failed' ||
    (code.includes('email') && (msg.includes('invalid') || msg.includes('format')))
  ) {
    return '유효하지 않은 이메일 형식입니다.'
  }

  return '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.'
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (isUnverifiedEmailError(error)) {
      return { error: UNVERIFIED_EMAIL_MESSAGE }
    }
    return { error: mapLoginErrorToKorean(error) }
  }

  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const nickname = (formData.get('nickname') as string)?.trim()

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' }
  }

  if (!nickname) {
    return { error: '닉네임을 입력해 주세요.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}
