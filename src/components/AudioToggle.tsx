import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioToggleProps {
  includeAudio: boolean;
  onToggle: (value: boolean) => void;
}

export const AudioToggle = ({ includeAudio, onToggle }: AudioToggleProps) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">
        Áudio
      </label>
      <div className="flex gap-3">
        <button
          onClick={() => onToggle(true)}
          className={cn(
            "flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-300",
            includeAudio
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50"
          )}
        >
          <Volume2 className="w-5 h-5" />
          <span className="font-medium">Com áudio</span>
        </button>
        <button
          onClick={() => onToggle(false)}
          className={cn(
            "flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-300",
            !includeAudio
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50"
          )}
        >
          <VolumeX className="w-5 h-5" />
          <span className="font-medium">Sem áudio</span>
        </button>
      </div>
    </div>
  );
};
