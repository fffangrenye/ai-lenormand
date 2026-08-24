import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Heart, Moon } from "lucide-react";

const iconMap = {
  love: Heart,
  career: BriefcaseBusiness,
  life: Moon
};

type Props = {
  type: "love" | "career" | "life";
  title: string;
  subtitle: string;
  tone: string;
};

export function DomainCard({ type, title, subtitle, tone }: Props) {
  const Icon = iconMap[type];
  return (
    <Link
      href={`/oracle?domain=${type}`}
      className="group flex min-h-44 flex-col justify-between rounded-lg border border-white/10 bg-panel p-5 transition hover:-translate-y-1 hover:border-white/25"
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-md ${tone}`}>
          <Icon size={22} />
        </span>
        <ArrowRight className="text-white/35 transition group-hover:translate-x-1 group-hover:text-white" size={18} />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/62">{subtitle}</p>
      </div>
    </Link>
  );
}
