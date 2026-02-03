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

      setProgress(50);

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

      setProgress(80);

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

      if (data.downloadServices) {
        setDownloadServices(data.downloadServices);
      }

      if (data.downloadUrl) {
        // Open the download service in a new tab
        window.open(data.downloadUrl, "_blank");
        setProgress(100);

        return {
          success: true,
          videoId: data.videoId,
          title: data.title,
          downloadUrl: data.downloadUrl,
          downloadServices: data.downloadServices,
        };
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
