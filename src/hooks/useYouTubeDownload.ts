import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DownloadService {
  name: string;
  url: string;
  description: string;
}

interface DownloadResult {
  success: boolean;
  videoId?: string;
  title?: string;
  downloadUrl?: string;
  downloadServices?: DownloadService[];
  error?: string;
  method?: "direct" | "fallback";
}

export const useYouTubeDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadServices, setDownloadServices] = useState<DownloadService[]>([]);

  const downloadVideo = async (
    url: string,
    quality: string,
    audioOnly: boolean
  ): Promise<DownloadResult> => {
    setIsDownloading(true);
    setProgress(20);
    setError(null);
    setDownloadServices([]);

    try {
      const qualityMap: Record<string, string> = {
        "2160p": "2160",
        "1080p": "1080",
        "720p": "720",
        "480p": "480",
        "360p": "360",
      };

      setProgress(40);

      const { data, error: fnError } = await supabase.functions.invoke(
        "youtube-download",
        {
          body: {
            url,
            quality: qualityMap[quality] || "720",
            audioOnly,
          },
        }
      );

      setProgress(70);

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        return {
          success: false,
          error: data.error,
        };
      }

      // Store fallback services if available
      if (data.downloadServices) {
        setDownloadServices(data.downloadServices);
      }

      setProgress(90);

      if (data.downloadUrl) {
        // For direct method, trigger actual download
        if (data.method === "direct") {
          console.log("Direct download URL received, triggering download...");
          
          // Create a hidden anchor element to trigger download
          const link = document.createElement("a");
          link.href = data.downloadUrl;
          link.download = data.filename || `${data.title || "video"}.${audioOnly ? "mp3" : "mp4"}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          
          // For Cobalt tunnel URLs, we need to open in new tab
          // The browser will handle the download natively
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setProgress(100);

          return {
            success: true,
            videoId: data.videoId,
            title: data.title,
            downloadUrl: data.downloadUrl,
            method: "direct",
          };
        } else {
          // Fallback: open external service
          console.log("Fallback method, opening external service...");
          window.open(data.downloadUrl, "_blank");
          setProgress(100);

          return {
            success: true,
            videoId: data.videoId,
            title: data.title,
            downloadUrl: data.downloadUrl,
            downloadServices: data.downloadServices,
            method: "fallback",
          };
        }
      }

      return {
        success: false,
        error: "Nenhuma URL de download disponível",
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro no download";
      console.error("Download error:", err);
      setError(message);
      return {
        success: false,
        error: message,
      };
    } finally {
      setIsDownloading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const openDownloadService = (serviceUrl: string) => {
    window.open(serviceUrl, "_blank");
  };

  return {
    downloadVideo,
    isDownloading,
    progress,
    error,
    downloadServices,
    openDownloadService,
  };
};
