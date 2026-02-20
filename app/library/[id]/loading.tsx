import BottomNav from '@/components/BottomNav'

export default function Loading() {
  return (
    <>
      <div className="flex min-h-screen flex-col bg-background px-4 pb-36 pt-6">
        <div className="mb-4 h-[200px] animate-pulse rounded-2xl bg-white/60" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-white/60" />
        <div className="mt-2 h-5 w-full animate-pulse rounded bg-white/60" />
        <div className="mt-6 flex gap-3">
          <div className="h-12 flex-1 animate-pulse rounded-xl bg-white/60" />
          <div className="h-12 flex-1 animate-pulse rounded-xl bg-white/60" />
        </div>
        <div className="mt-8 h-5 w-1/2 animate-pulse rounded bg-white/60" />
        <div className="-mx-4 mt-3 flex gap-3 overflow-hidden px-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 min-w-[140px] animate-pulse rounded-xl bg-white/60"
            />
          ))}
        </div>
        <div className="mt-8 h-14 animate-pulse rounded-lg bg-primary/20" />
      </div>
      <BottomNav />
    </>
  )
}
