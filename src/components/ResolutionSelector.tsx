import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Resolution {
  id: string;
  label: string;
  quality: string;
  size: string;
}

const resolutions: Resolution[] = [
  { id: "2160p", label: "4K", quality: "2160p", size: "~2.5 GB" },
  { id: "1080p", label: "Full HD", quality: "1080p", size: "~800 MB" },
  { id: "720p", label: "HD", quality: "720p", size: "~400 MB" },
  { id: "480p", label: "SD", quality: "480p", size: "~200 MB" },
  { id: "360p", label: "Low", quality: "360p", size: "~100 MB" },
];

interface ResolutionSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export const ResolutionSelector = ({ selected, onSelect }: ResolutionSelectorProps) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">
        Resolução
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {resolutions.map((res) => (
          <button
            key={res.id}
            onClick={() => onSelect(res.id)}
            className={cn(
              "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300",
              selected === res.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:bg-secondary/50"
            )}
          >
            {selected === res.id && (
              <div className="absolute top-1 right-1">
                <Check className="w-3 h-3 text-primary" />
              </div>
            )}
            <span className="font-bold text-lg">{res.label}</span>
            <span className="text-xs opacity-70">{res.quality}</span>
            <span className="text-xs opacity-50 mt-1">{res.size}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
