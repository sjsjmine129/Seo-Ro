'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addInterest(libraryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('user_interested_libraries')
    .insert({ user_id: user.id, library_id: libraryId })

  if (error) throw error
  revalidatePath('/library/[id]', 'page')
  revalidatePath('/')
}

export async function removeInterest(libraryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('user_interested_libraries')
    .delete()
    .eq('user_id', user.id)
    .eq('library_id', libraryId)

  if (error) throw error
  revalidatePath('/library/[id]', 'page')
  revalidatePath('/')
}
