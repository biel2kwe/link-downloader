import { useState } from "react";

interface DownloadResult {
  success: boolean;
  videoId?: string;
  title?: string;
  error?: string;
  downloadUrl?: string;
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
    setProgress(20);
    setError(null);

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
          action: "download",
        }),
      });

      setProgress(60);

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      if (!data.downloadUrl) {
        setError("URL de download não disponível");
        return { success: false, error: "URL de download não disponível" };
      }

      setProgress(80);
      console.log("Opening download URL in browser...", data.downloadUrl.substring(0, 80));

      // Open the download URL directly in a new tab
      // The browser will handle the file download natively
      const newWindow = window.open(data.downloadUrl, "_blank");
      
      // If popup was blocked, try with a link click
      if (!newWindow) {
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
        title: data.title || data.filename,
        downloadUrl: data.downloadUrl,
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro no download";
      console.error("Download error:", err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsDownloading(false);
      setTimeout(() => setProgress(0), 3000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return {
    downloadVideo,
    isDownloading,
    progress,
    error,
    formatFileSize,
  };
};
