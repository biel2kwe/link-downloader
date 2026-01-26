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
    setProgress(10);
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

      setProgress(20);

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

      setProgress(40);

      // If external link, just open it
      if (data.isExternal) {
        window.open(data.downloadUrl, "_blank");
        setProgress(100);
        return {
          success: true,
          downloadUrl: data.downloadUrl,
          filename: data.filename,
        };
      }

      // For direct download URLs (like Cobalt tunnel), 
      // we need to fetch and create a blob since the URL 
      // might have CORS restrictions for direct browser download
      if (data.directDownload && data.downloadUrl) {
        setProgress(50);
        
        try {
          // Try to fetch the video directly
          const response = await fetch(data.downloadUrl, {
            method: "GET",
            mode: "cors",
          });

          if (!response.ok) {
            // If CORS fails, open in new tab as fallback
            console.log("CORS issue, opening in new tab");
            window.open(data.downloadUrl, "_blank");
            setProgress(100);
            return {
              success: true,
              downloadUrl: data.downloadUrl,
              filename: data.filename,
            };
          }

          // Get content info
          const contentLength = response.headers.get("content-length");
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          setTotalBytes(total);

          setProgress(60);

          // Read the stream
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("Não foi possível ler o stream");
          }

          const chunks: Uint8Array[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            received += value.length;
            setDownloadedBytes(received);

            // Update progress (60-95%)
            if (total > 0) {
              const downloadProgress = (received / total) * 35;
              setProgress(60 + Math.min(downloadProgress, 35));
            } else {
              setProgress(Math.min(90, 60 + (received / 10000000) * 30));
            }
          }

          setProgress(95);

          // Verify we got data
          if (received < 1000) {
            throw new Error("Arquivo muito pequeno");
          }

          // Combine chunks
          const combined = new Uint8Array(received);
          let position = 0;
          for (const chunk of chunks) {
            combined.set(chunk, position);
            position += chunk.length;
          }

          // Create blob
          const mimeType = audioOnly ? "audio/mpeg" : "video/mp4";
          const blob = new Blob([combined.buffer], { type: mimeType });

          // Create download
          const filename = data.filename || `video_${Date.now()}.${audioOnly ? "mp3" : "mp4"}`;
          const blobUrl = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

          setProgress(100);

          return {
            success: true,
            downloadUrl: blobUrl,
            filename: filename,
            fileSize: blob.size,
          };

        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          // Fallback: open directly in new tab
          window.open(data.downloadUrl, "_blank");
          setProgress(100);
          return {
            success: true,
            downloadUrl: data.downloadUrl,
            filename: data.filename,
          };
        }
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
