import { useState } from "react";
import { Download, Link, Loader2, AlertCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoPreview } from "./VideoPreview";
import { ResolutionSelector } from "./ResolutionSelector";
import { AudioToggle } from "./AudioToggle";
import { useToast } from "@/hooks/use-toast";

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const YouTubeDownloader = () => {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resolution, setResolution] = useState("1080p");
  const [includeAudio, setIncludeAudio] = useState(true);
  const { toast } = useToast();

  const handleUrlSubmit = () => {
    if (!url.trim()) {
      toast({
        title: "URL necessária",
        description: "Por favor, insira um link do YouTube.",
        variant: "destructive",
      });
      return;
    }

    const id = extractVideoId(url);
    if (!id) {
      toast({
        title: "URL inválida",
        description: "Por favor, insira um link válido do YouTube.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setVideoId(id);
      setIsLoading(false);
    }, 800);
  };

  const handleDownload = () => {
    toast({
      title: "Backend necessário",
      description: "Para baixar vídeos do YouTube, é necessário conectar o Lovable Cloud para processar os vídeos no servidor.",
    });
  };

  const handleReset = () => {
    setUrl("");
    setVideoId(null);
    setResolution("1080p");
    setIncludeAudio(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Youtube className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
            YouTube <span className="text-primary">Downloader</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Baixe vídeos do YouTube em alta qualidade
          </p>
        </div>

        {/* URL Input */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="url"
                placeholder="Cole o link do YouTube aqui..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                className="pl-12"
              />
            </div>
            <Button
              onClick={handleUrlSubmit}
              disabled={isLoading}
              variant="glow"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Buscar"
              )}
            </Button>
          </div>
        </div>

        {/* Video Preview & Options */}
        {videoId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <VideoPreview videoId={videoId} />

            <div className="glass-card p-6 space-y-6">
              <ResolutionSelector
                selected={resolution}
                onSelect={setResolution}
              />

              <AudioToggle
                includeAudio={includeAudio}
                onToggle={setIncludeAudio}
              />

              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
                <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Processamento no servidor necessário</p>
                  <p>
                    Baixar vídeos do YouTube requer processamento no servidor devido às restrições do navegador. 
                    Conecte o Lovable Cloud para habilitar esta funcionalidade.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                >
                  Limpar
                </Button>
                <Button
                  variant="glow"
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-5 h-5" />
                  Baixar {resolution} {includeAudio ? "com áudio" : "sem áudio"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative mt-12 text-center text-sm text-muted-foreground">
        <p>Use apenas para baixar vídeos que você tem permissão</p>
      </div>
    </div>
  );
};
