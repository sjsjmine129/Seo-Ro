'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
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
