'use server'

import { MAX_FAVORITE_LIBRARIES } from '@/lib/constants'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addInterest(libraryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { count, error: countError } = await supabase
    .from('user_interested_libraries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) throw countError
  if ((count ?? 0) >= MAX_FAVORITE_LIBRARIES) {
    throw new Error(
      `관심 도서관은 최대 ${MAX_FAVORITE_LIBRARIES}개까지 등록할 수 있습니다.`,
    )
  }

  const { error } = await supabase
    .from('user_interested_libraries')
    .insert({ user_id: user.id, library_id: libraryId })

  if (error) throw error
  revalidatePath('/library/[id]', 'page')
  revalidatePath('/')
  revalidatePath('/mypage')
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
  revalidatePath('/mypage')
}
