'use client'

import { useState } from 'react'
import { Globe, Heart } from 'lucide-react'

type Library = {
  id: string
  name: string
  address: string | null
  homepage_url: string | null
}

type Props = {
  library: Library
  isInterested: boolean
  userLibraryCount: number
  maxAllowed: number
  onAddInterest: (libraryId: string) => Promise<void>
  onRemoveInterest: (libraryId: string) => Promise<void>
}

export default function LibraryDetailClient({
  library,
  isInterested,
  userLibraryCount,
  maxAllowed,
  onAddInterest,
  onRemoveInterest,
}: Props) {
  const [interested, setInterested] = useState(isInterested)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleToggle = async () => {
    if (loading) return
    setLoading(true)
    try {
      if (interested) {
        if (userLibraryCount <= 1) {
          showToast('최소 1개의 관심 도서관은 유지해야 합니다. 다른 도서관을 추가한 뒤 해제해주세요.')
          setLoading(false)
          return
        }
        await onRemoveInterest(library.id)
        setInterested(false)
      } else {
        if (userLibraryCount >= maxAllowed) {
          showToast('관심 도서관이 꽉 찼습니다. 기존 도서관을 삭제하거나 책장 점수를 올려 등록 가능 수를 늘려주세요.')
          setLoading(false)
          return
        }
        await onAddInterest(library.id)
        setInterested(true)
      }
    } catch {
      showToast('요청을 처리할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-3">
        {library.homepage_url && (
          <a
            href={library.homepage_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/90 py-3 text-sm font-medium text-primary shadow-sm backdrop-blur-md transition-opacity hover:opacity-90"
          >
            <Globe className="h-4 w-4" />
            홈페이지
          </a>
        )}
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/40 py-3 text-sm font-medium shadow-sm backdrop-blur-md transition-opacity hover:opacity-90 disabled:opacity-60 ${
            interested
              ? 'bg-accent/20 text-accent border-accent/30'
              : 'bg-white/90 text-primary'
          }`}
        >
          <Heart
            className="h-4 w-4"
            fill={interested ? 'currentColor' : 'none'}
            strokeWidth={2}
          />
          관심 도서관
        </button>
      </div>

      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-3 text-center text-sm text-white shadow-lg"
          role="alert"
        >
          {toast}
        </div>
      )}
    </>
  )
}
