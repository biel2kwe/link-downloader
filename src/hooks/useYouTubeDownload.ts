import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  suggestion?: string;
  alternativeUrl?: string;
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
      // Map quality string to numeric value
      const qualityMap: Record<string, string> = {
        "2160p": "2160",
        "1080p": "1080",
        "720p": "720",
        "480p": "480",
        "360p": "360",
      };

      setProgress(30);

      const { data, error: fnError } = await supabase.functions.invoke("youtube-download", {
        body: {
          url,
          quality: qualityMap[quality] || "1080",
          audioOnly,
        },
      });

      setProgress(70);

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        return {
          success: false,
          error: data.error,
          suggestion: data.suggestion,
          alternativeUrl: data.alternativeUrl,
        };
      }

      setProgress(100);

      // If we have a download URL, trigger the download
      if (data.downloadUrl) {
        // Open download in new tab
        window.open(data.downloadUrl, "_blank");
        
        return {
          success: true,
          downloadUrl: data.downloadUrl,
          filename: data.filename,
        };
      }

      return {
        success: false,
        error: "No download URL received",
        suggestion: data.suggestion,
        alternativeUrl: data.alternativeUrl,
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      return {
        success: false,
        error: message,
      };
    } finally {
      setIsDownloading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return {
    downloadVideo,
    isDownloading,
    progress,
    error,
  };
};
