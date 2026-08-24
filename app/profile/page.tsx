import { Settings, UserRound } from "lucide-react";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="rounded-lg border border-white/10 bg-panel p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gold text-ink">
            <UserRound size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Guest Seeker</h1>
            <p className="mt-1 text-white/58">Free Plan</p>
          </div>
        </div>
        <div className="mt-8 grid gap-3">
          <button className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-ink px-4 text-left hover:bg-white/10">
            <Settings size={18} className="text-gold" />
            设置
          </button>
        </div>
      </section>
    </main>
  );
}
