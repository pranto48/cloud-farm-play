import { Sprout } from "lucide-react";

export function GameCover({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const hue = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={"relative flex aspect-[16/10] w-full items-end overflow-hidden rounded-lg " + (className ?? "")}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 40) % 360} 70% 70%) 60%, hsl(${(hue + 80) % 360} 80% 80%))` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_50%)]" />
      <Sprout className="absolute right-3 top-3 h-6 w-6 text-white/70" />
      <div className="relative w-full bg-gradient-to-t from-black/60 to-transparent p-3">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
      </div>
    </div>
  );
}
