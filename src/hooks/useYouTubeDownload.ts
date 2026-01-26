import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  suggestion?: string;
  alternativeUrl?: string;
  fileSize?: number;
}

export const useYouTubeDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const downloadVideo = async (
    url: string,
    quality: string,
    audioOnly: boolean
  ): Promise<DownloadResult> => {
    setIsDownloading(true);
    setProgress(5);
    setDownloadedBytes(0);
    setTotalBytes(0);
    setError(null);

    try {
      const qualityMap: Record<string, string> = {
        "2160p": "2160",
        "1080p": "1080",
        "720p": "720",
        "480p": "480",
        "360p": "360",
      };

      setProgress(10);

      // Step 1: Get download info
      const { data: infoData, error: infoError } = await supabase.functions.invoke(
        "youtube-download",
        {
          body: {
            url,
            quality: qualityMap[quality] || "1080",
            audioOnly,
            proxyDownload: false,
          },
        }
      );

      if (infoError) {
        throw new Error(infoError.message);
      }

      if (infoData.error) {
        setError(infoData.error);
        return {
          success: false,
          error: infoData.error,
          suggestion: infoData.suggestion,
        };
      }

      // If external link, just open it
      if (infoData.isExternal) {
        window.open(infoData.downloadUrl, "_blank");
        setProgress(100);
        return {
          success: true,
          downloadUrl: infoData.downloadUrl,
          filename: infoData.filename,
        };
      }

      setProgress(20);

      // Step 2: Download through proxy (edge function streams the file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const proxyResponse = await fetch(
        `${supabaseUrl}/functions/v1/youtube-download`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
          },
          body: JSON.stringify({
            url,
            quality: qualityMap[quality] || "1080",
            audioOnly,
            proxyDownload: true,
          }),
        }
      );

      if (!proxyResponse.ok) {
        const errorText = await proxyResponse.text();
        console.error("Proxy error:", errorText);
        throw new Error("Falha no download do vídeo");
      }

      setProgress(30);

      // Check content type - if JSON, it's an error
      const contentType = proxyResponse.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const jsonError = await proxyResponse.json();
        throw new Error(jsonError.error || "Download failed");
      }

      // Get content length
      const contentLength = proxyResponse.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      setTotalBytes(total);

      // Read the stream
      const reader = proxyResponse.body?.getReader();
      if (!reader) {
        throw new Error("Não foi possível ler a resposta");
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;
        setDownloadedBytes(received);

        // Update progress (30-95%)
        if (total > 0) {
          const downloadProgress = (received / total) * 65;
          setProgress(30 + Math.min(downloadProgress, 65));
        } else {
          setProgress(Math.min(90, 30 + (received / 10000000) * 60));
        }
      }

      setProgress(95);

      // Verify we got data
      if (chunks.length === 0 || received === 0) {
        throw new Error("Arquivo vazio recebido");
      }

      // Combine chunks
      const combined = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) {
        combined.set(chunk, position);
        position += chunk.length;
      }

      // Create blob with correct MIME type
      const mimeType = audioOnly ? "audio/mpeg" : "video/mp4";
      const blob = new Blob([combined.buffer], { type: mimeType });

      // Double check blob size
      if (blob.size < 1000) {
        throw new Error("Arquivo muito pequeno - download incompleto");
      }

      // Create download
      const filename = infoData.filename || `video_${Date.now()}.${audioOnly ? "mp3" : "mp4"}`;
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup after delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setProgress(100);

      return {
        success: true,
        downloadUrl: blobUrl,
        filename: filename,
        fileSize: blob.size,
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
      setTimeout(() => {
        setProgress(0);
        setDownloadedBytes(0);
        setTotalBytes(0);
      }, 3000);
    }
  };

  return {
    downloadVideo,
    isDownloading,
    progress,
    downloadedBytes,
    totalBytes,
    formatBytes,
    error,
  };
};
