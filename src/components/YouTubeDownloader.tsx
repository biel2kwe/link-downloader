import { useState } from "react";
import { Download, Link, Loader2, AlertCircle, Youtube, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { VideoPreview } from "./VideoPreview";
import { ResolutionSelector } from "./ResolutionSelector";
import { AudioToggle } from "./AudioToggle";
import { useToast } from "@/hooks/use-toast";
import { useYouTubeDownload } from "@/hooks/useYouTubeDownload";

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
  const [alternativeUrl, setAlternativeUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { downloadVideo, isDownloading, progress, downloadedBytes, totalBytes, formatBytes, error: downloadError } = useYouTubeDownload();

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
    setAlternativeUrl(null);
    setTimeout(() => {
      setVideoId(id);
      setIsLoading(false);
    }, 800);
  };

  const handleDownload = async () => {
    if (!url) return;

    const audioOnly = !includeAudio;
    const result = await downloadVideo(url, resolution, audioOnly);

    if (result.success) {
      toast({
        title: "Download iniciado!",
        description: "O vídeo está sendo baixado em uma nova aba.",
      });
    } else {
      toast({
        title: "Erro no download",
        description: result.suggestion || result.error || "Falha ao processar o vídeo.",
        variant: "destructive",
      });
    }
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

              {/* Download progress */}
              {isDownloading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {progress < 30 ? "Preparando download..." : "Baixando vídeo..."}
                    </span>
                    <span className="text-primary font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  {downloadedBytes > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatBytes(downloadedBytes)} baixados</span>
                      {totalBytes > 0 && (
                        <span>de {formatBytes(totalBytes)}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error/Alternative banner */}
              {downloadError && alternativeUrl && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground flex-1">
                    <p className="font-medium text-foreground mb-2">Serviço temporariamente indisponível</p>
                    <p className="mb-3">
                      Use o link alternativo abaixo para baixar o vídeo:
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(alternativeUrl, "_blank")}
                      className="gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir site alternativo
                    </Button>
                  </div>
                </div>
              )}

              {/* Success state info */}
              {!isDownloading && !downloadError && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Pronto para download</p>
                    <p>
                      Clique no botão abaixo para iniciar o download. O vídeo será aberto em uma nova aba.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                  disabled={isDownloading}
                >
                  Limpar
                </Button>
                <Button
                  variant="glow"
                  className="flex-1"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {isDownloading ? "Processando..." : `Baixar ${resolution} ${includeAudio ? "com áudio" : "sem áudio"}`}
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
