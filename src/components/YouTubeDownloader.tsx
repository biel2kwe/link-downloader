import { useState } from "react";
import { Link, Loader2, Youtube, ExternalLink, Music, Video, Download, CheckCircle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { VideoPreview } from "./VideoPreview";
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
  const [audioOnly, setAudioOnly] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const { toast } = useToast();
  const { 
    processVideo, 
    isProcessing, 
    error: processError,
    fallbackServices,
    videoTitle,
    downloadProgress,
    fileSize,
    formatFileSize,
    openService,
    reset,
  } = useYouTubeDownload();

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
    setDownloadComplete(false);
    setTimeout(() => {
      setVideoId(id);
      setIsLoading(false);
    }, 500);
  };

  const handleProcess = async () => {
    if (!url) return;
    setDownloadComplete(false);

    const result = await processVideo(url, audioOnly);

    if (result.success) {
      setDownloadComplete(true);
      toast({
        title: "Download concluído!",
        description: `${result.filename} (${formatFileSize(result.fileSize || 0)})`,
      });
    } else if (result.fallbackServices && result.fallbackServices.length > 0) {
      toast({
        title: "Use um serviço alternativo",
        description: "O download direto não está disponível. Use um dos serviços abaixo.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Erro",
        description: result.error || "Falha ao processar o vídeo.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setUrl("");
    setVideoId(null);
    setAudioOnly(false);
    setDownloadComplete(false);
    reset();
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
            Baixador de videos do Youtube
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
              {/* Format Toggle */}
              <div className="flex gap-3">
                <Button
                  variant={!audioOnly ? "default" : "outline"}
                  className="flex-1 gap-2"
                  onClick={() => setAudioOnly(false)}
                >
                  <Video className="w-4 h-4" />
                  Vídeo (MP4)
                </Button>
                <Button
                  variant={audioOnly ? "default" : "outline"}
                  className="flex-1 gap-2"
                  onClick={() => setAudioOnly(true)}
                >
                  <Music className="w-4 h-4" />
                  Áudio (MP3)
                </Button>
              </div>

              {/* Process Button */}
              {!downloadComplete && fallbackServices.length === 0 && (
                <div className="space-y-4">
                  <Button
                    variant="glow"
                    className="w-full"
                    onClick={handleProcess}
                    disabled={isProcessing}
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Baixando...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        Baixar {audioOnly ? "MP3" : "MP4"}
                      </>
                    )}
                  </Button>

                  {/* Progress indicator */}
                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={downloadProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processando vídeo...</span>
                        {fileSize > 0 && <span>{formatFileSize(fileSize)}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Download Complete */}
              {downloadComplete && (
                <div className="space-y-4">
                  <div className="text-center p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <div className="inline-flex items-center gap-2 text-green-500 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Download concluído!</span>
                    </div>
                    {videoTitle && (
                      <p className="text-sm text-muted-foreground">{videoTitle}</p>
                    )}
                    {fileSize > 0 && (
                      <p className="text-sm font-medium text-green-500 mt-1">
                        <FileDown className="w-4 h-4 inline mr-1" />
                        {formatFileSize(fileSize)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Fallback Services */}
              {fallbackServices.length > 0 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">
                      {videoTitle && <span className="font-medium text-foreground">{videoTitle}</span>}
                    </p>
                    <p className="text-sm text-yellow-500">
                      APIs diretas indisponíveis. Use um serviço externo:
                    </p>
                  </div>
                  
                  <div className="grid gap-3">
                    {fallbackServices.map((service, index) => (
                      <Button
                        key={service.name}
                        variant={index === 0 ? "default" : "outline"}
                        className="w-full justify-between h-auto py-3"
                        onClick={() => openService(service.url)}
                      >
                        <div className="flex items-center gap-3">
                          <ExternalLink className="w-4 h-4" />
                          <div className="text-left">
                            <div className="font-medium">{service.name}</div>
                            <div className="text-xs opacity-70">{service.description}</div>
                          </div>
                        </div>
                        {index === 0 && (
                          <span className="text-xs bg-primary-foreground/20 px-2 py-1 rounded">
                            Recomendado
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Cole o link do vídeo no serviço escolhido para baixar.
                  </p>
                </div>
              )}

              {/* Error state */}
              {processError && !fallbackServices.length && !downloadComplete && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
                  <p className="text-sm text-destructive">{processError}</p>
                </div>
              )}

              {/* Reset Button */}
              {(downloadComplete || fallbackServices.length > 0) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleReset}
                >
                  Baixar outro vídeo
                </Button>
              )}
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
