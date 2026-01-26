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

      setProgress(20);

      const { data, error: fnError } = await supabase.functions.invoke("youtube-download", {
        body: {
          url,
          quality: qualityMap[quality] || "1080",
          audioOnly,
        },
      });

      setProgress(40);

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

      // If we have a download URL, properly download the file
      if (data.downloadUrl) {
        const filename = data.filename || `video_${Date.now()}.mp4`;
        
        // Check if it's an external redirect (like ssyoutube)
        if (data.isExternal) {
          window.open(data.downloadUrl, "_blank");
          setProgress(100);
          return {
            success: true,
            downloadUrl: data.downloadUrl,
            filename: filename,
          };
        }

        setProgress(50);

        try {
          // Fetch the actual video file
          const response = await fetch(data.downloadUrl, {
            method: "GET",
            headers: {
              "Accept": "*/*",
            },
          });

          if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
          }

          setProgress(60);

          // Get content length for progress tracking
          const contentLength = response.headers.get("content-length");
          const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

          // Read the response as a stream for progress tracking
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("Failed to read response body");
          }

          const chunks: Uint8Array[] = [];
          let receivedLength = 0;

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            chunks.push(value);
            receivedLength += value.length;

            // Update progress (60-95% during download)
            if (totalSize > 0) {
              const downloadProgress = (receivedLength / totalSize) * 35;
              setProgress(60 + Math.min(downloadProgress, 35));
            } else {
              // If no content-length, show indeterminate progress
              setProgress(Math.min(95, 60 + (receivedLength / 1000000) * 10));
            }
          }

          setProgress(95);

          // Combine chunks into a single ArrayBuffer
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const combined = new Uint8Array(totalLength);
          let position = 0;
          for (const chunk of chunks) {
            combined.set(chunk, position);
            position += chunk.length;
          }

          const blob = new Blob([combined.buffer], { 
            type: audioOnly ? "audio/mpeg" : "video/mp4" 
          });

          // Verify blob has content
          if (blob.size === 0) {
            throw new Error("Downloaded file is empty");
          }

          // Create download link
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

          setProgress(100);

          return {
            success: true,
            downloadUrl: data.downloadUrl,
            filename: filename,
          };

        } catch (fetchError) {
          console.error("Direct download failed, trying alternative method:", fetchError);
          
          // Fallback: try using an anchor tag with the URL directly
          // Some cobalt instances return direct download links
          const link = document.createElement("a");
          link.href = data.downloadUrl;
          link.download = filename;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setProgress(100);

          return {
            success: true,
            downloadUrl: data.downloadUrl,
            filename: filename,
          };
        }
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
