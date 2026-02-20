import BottomNav from '@/components/BottomNav'

export default function Loading() {
  return (
    <>
      <main className="flex min-h-screen flex-col px-4 pb-32 pt-4">
        {/* Skeleton header */}
        <header className="sticky top-0 z-40 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-white/40 bg-white/90 px-4 py-3 backdrop-blur-md">
          <div className="h-6 w-48 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
        </header>

        {/* Skeleton cards */}
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex gap-4 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md"
            >
              <div className="h-28 w-20 flex-shrink-0 animate-pulse rounded-lg bg-neutral-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-neutral-200" />
                <div className="mt-2 h-10 w-full animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
