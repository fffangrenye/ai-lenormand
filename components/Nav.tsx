import Link from "next/link";
import { BookOpen, Home, Sparkles, UserRound, Waves } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/oracle", label: "Oracle", icon: Sparkles },
  { href: "/space", label: "Space", icon: Waves },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: UserRound }
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-sm font-bold text-ink">S</span>
          <span className="text-base font-semibold text-white">Soul AI</span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className="grid h-10 w-10 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white sm:w-auto sm:grid-flow-col sm:gap-2 sm:px-3"
              >
                <Icon size={18} />
                <span className="hidden text-sm sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
