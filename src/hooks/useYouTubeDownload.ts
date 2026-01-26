import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  suggestion?: string;
  fileSize?: number;
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

      // Get download URL from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        "youtube-download",
        {
          body: {
            url,
            quality: qualityMap[quality] || "1080",
            audioOnly,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        return {
          success: false,
          error: data.error,
          suggestion: data.suggestion,
        };
      }

      setProgress(60);

      if (data.downloadUrl) {
        setProgress(80);
        
        // Open the cobalt tunnel URL directly in a new tab
        // This bypasses CORS since it's a direct navigation, not a fetch
        const newWindow = window.open(data.downloadUrl, "_blank");
        
        // Also create a hidden iframe to trigger download without leaving the page
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = data.downloadUrl;
        document.body.appendChild(iframe);
        
        // Remove iframe after 30 seconds
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 30000);

        setProgress(100);

        return {
          success: true,
          downloadUrl: data.downloadUrl,
          filename: data.filename,
        };
      }

      return {
        success: false,
        error: "No download URL received",
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
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
