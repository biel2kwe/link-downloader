import { useState } from "react";

interface FallbackService {
  name: string;
  url: string;
  description: string;
}

interface DownloadResult {
  success: boolean;
  title?: string;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  fallbackServices?: FallbackService[];
}

export const useYouTubeDownload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackServices, setFallbackServices] = useState<FallbackService[]>([]);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const processVideo = async (
    url: string,
    audioOnly: boolean,
    quality?: string
  ): Promise<DownloadResult> => {
    setIsProcessing(true);
    setError(null);
    setFallbackServices([]);
    setVideoTitle("");
    setDownloadUrl(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/youtube-download`;

      console.log("Requesting download from edge function...");

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          url,
          audioOnly,
          quality,
        }),
      });

      const data = await response.json();
      console.log("Edge function response:", data);

      if (data.error && !data.fallbackServices) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      setVideoTitle(data.title || "");

      // If we got a direct download URL
      if (data.success && data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        return {
          success: true,
          title: data.title,
          downloadUrl: data.downloadUrl,
          filename: data.filename,
        };
      }

      // If APIs failed but we have fallback services
      if (data.fallbackServices && data.fallbackServices.length > 0) {
        setFallbackServices(data.fallbackServices);
        setError(data.error || "APIs não disponíveis");
        return {
          success: false,
          title: data.title,
          error: data.error,
          fallbackServices: data.fallbackServices,
        };
      }

      setError("Nenhum serviço de download disponível");
      return { success: false, error: "Nenhum serviço de download disponível" };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao processar";
      console.error("Process error:", err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerDownload = (url: string, filename?: string) => {
    // Try to download via a hidden link
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    
    if (filename) {
      link.download = filename;
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openService = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const reset = () => {
    setFallbackServices([]);
    setVideoTitle("");
    setError(null);
    setDownloadUrl(null);
  };

  return {
    processVideo,
    isProcessing,
    error,
    fallbackServices,
    videoTitle,
    downloadUrl,
    triggerDownload,
    openService,
    reset,
  };
};
