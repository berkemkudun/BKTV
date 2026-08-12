"use client";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/** Yatay kaydırılabilir filtre çipleri (platform / kategori / ülke). */
export function FilterBar({
  options,
  value,
  onChange,
  allLabel = "Tümü",
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  const all: FilterOption[] = [{ value: "", label: allLabel }, ...options];

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-1 lg:px-8">
      {all.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value || "__all"}
            type="button"
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
              active
                ? "bg-accent text-white"
                : "border border-white/8 bg-white/[0.04] text-fg-muted hover:bg-white/[0.08] hover:text-fg"
            }`}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span className={`ml-1.5 text-[12px] ${active ? "text-white/70" : "text-fg-dim"}`}>
                {option.count.toLocaleString("tr-TR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
