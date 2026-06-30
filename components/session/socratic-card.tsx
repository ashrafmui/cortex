import type { SocraticResponse } from "@/lib/orchestrator/types";

export function SocraticCard({ data }: { data: SocraticResponse }) {
  return (
    <div className="rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed max-w-[85%]">
      <p className="italic">{data.question}</p>
    </div>
  );
}
