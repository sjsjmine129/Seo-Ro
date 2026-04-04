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
    return { error: error.message }
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
