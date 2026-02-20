import BottomNav from '@/components/BottomNav'

export default function Home() {
  return (
    <>
      <main className="flex min-h-screen flex-col px-4 pb-24 pt-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-foreground">Seo-Ro Home</h1>
        </header>
        <p className="text-foreground/70">
          Home feed and book list will go here. Bottom nav is below for visual
          testing.
        </p>
      </main>
      <BottomNav />
    </>
  );
}
