import { useState } from "react";

interface ExternalService {
  name: string;
  url: string;
}

interface DownloadResult {
  success: boolean;
  title?: string;
  error?: string;
  downloadUrl?: string;
  method?: "direct" | "external";
  externalServices?: ExternalService[];
}

export const useYouTubeDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [externalServices, setExternalServices] = useState<ExternalService[]>([]);

  const downloadVideo = async (
    url: string,
    quality: string,
    audioOnly: boolean
  ): Promise<DownloadResult> => {
    setIsDownloading(true);
    setProgress(20);
    setError(null);
    setExternalServices([]);

    try {
      const qualityMap: Record<string, string> = {
        "2160p": "2160",
        "1080p": "1080",
        "720p": "720",
        "480p": "480",
        "360p": "360",
      };

      setProgress(40);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/youtube-download`;

      console.log("Requesting download URL from edge function...");

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          url,
          quality: qualityMap[quality] || "720",
          audioOnly,
        }),
      });

      setProgress(60);

      const data = await response.json();
      console.log("Edge function response:", data);

      if (data.error) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      setProgress(80);

      // Method 1: Direct download URL
      if (data.method === "direct" && data.downloadUrl) {
        console.log("Opening direct download URL:", data.downloadUrl.substring(0, 80));
        
        // Open download in new tab - browser handles it
        const newWindow = window.open(data.downloadUrl, "_blank");
        
        if (!newWindow) {
          // Fallback: create and click a link
          const link = document.createElement("a");
          link.href = data.downloadUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        setProgress(100);

        return {
          success: true,
          title: data.title,
          downloadUrl: data.downloadUrl,
          method: "direct",
        };
      }

      // Method 2: External services fallback
      if (data.method === "external" && data.externalServices) {
        console.log("Using external services fallback");
        setExternalServices(data.externalServices);
        
        // Auto-open the first service
        if (data.externalServices.length > 0) {
          window.open(data.externalServices[0].url, "_blank");
        }

        setProgress(100);

        return {
          success: true,
          title: data.title,
          method: "external",
          externalServices: data.externalServices,
        };
      }

      // No valid response
      setError("Não foi possível obter link de download");
      return { success: false, error: "Não foi possível obter link de download" };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro no download";
      console.error("Download error:", err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsDownloading(false);
      setTimeout(() => {
        setProgress(0);
        setExternalServices([]);
      }, 5000);
    }
  };

  const openExternalService = (url: string) => {
    window.open(url, "_blank");
  };

  return {
    downloadVideo,
    isDownloading,
    progress,
    error,
    externalServices,
    openExternalService,
  };
};
