import { useState } from "react";

interface DownloadService {
  name: string;
  url: string;
  description: string;
}

interface DownloadResult {
  success: boolean;
  title?: string;
  error?: string;
  downloadServices?: DownloadService[];
}

export const useYouTubeDownload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadServices, setDownloadServices] = useState<DownloadService[]>([]);
  const [videoTitle, setVideoTitle] = useState<string>("");

  const processVideo = async (
    url: string,
    audioOnly: boolean
  ): Promise<DownloadResult> => {
    setIsProcessing(true);
    setError(null);
    setDownloadServices([]);
    setVideoTitle("");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/youtube-download`;

      console.log("Requesting download services from edge function...");

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
        }),
      });

      const data = await response.json();
      console.log("Edge function response:", data);

      if (data.error) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      if (data.downloadServices && data.downloadServices.length > 0) {
        setDownloadServices(data.downloadServices);
        setVideoTitle(data.title || "");
        
        return {
          success: true,
          title: data.title,
          downloadServices: data.downloadServices,
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

  const openService = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const reset = () => {
    setDownloadServices([]);
    setVideoTitle("");
    setError(null);
  };

  return {
    processVideo,
    isProcessing,
    error,
    downloadServices,
    videoTitle,
    openService,
    reset,
  };
};
