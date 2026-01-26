import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  isExternal?: boolean;
}

export const useYouTubeDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const downloadVideo = async (
    url: string,
    quality: string,
    audioOnly: boolean
  ): Promise<DownloadResult> => {
    setIsDownloading(true);
    setProgress(10);
    setError(null);

    try {
      const qualityMap: Record<string, string> = {
        "2160p": "2160",
        "1080p": "1080",
        "720p": "720",
        "480p": "480",
        "360p": "360",
      };

      setProgress(30);

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

      setProgress(60);

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

      if (data.downloadUrl) {
        setProgress(80);
        
        // If external (like y2mate), just open in new tab
        if (data.isExternal) {
          window.open(data.downloadUrl, "_blank");
          setProgress(100);
          return {
            success: true,
            downloadUrl: data.downloadUrl,
            filename: data.filename,
            isExternal: true,
          };
        }

        // For cobalt URLs, create a download link
        // The browser will handle the download natively
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = data.filename || "video.mp4";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        
        // Append, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setProgress(100);

        return {
          success: true,
          downloadUrl: data.downloadUrl,
          filename: data.filename,
        };
      }

      return {
        success: false,
        error: "Nenhuma URL de download recebida",
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

  return {
    downloadVideo,
    isDownloading,
    progress,
    error,
  };
};
