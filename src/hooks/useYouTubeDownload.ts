import { useState } from "react";

interface DownloadResult {
  success: boolean;
  videoId?: string;
  title?: string;
  error?: string;
  fileSize?: number;
}

export const useYouTubeDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadedSize, setDownloadedSize] = useState<number>(0);

  const downloadVideo = async (
    url: string,
    quality: string,
    audioOnly: boolean
  ): Promise<DownloadResult> => {
    setIsDownloading(true);
    setProgress(10);
    setError(null);
    setDownloadedSize(0);

    try {
      const qualityMap: Record<string, string> = {
        "2160p": "2160",
        "1080p": "1080",
        "720p": "720",
        "480p": "480",
        "360p": "360",
      };

      setProgress(20);

      // Get the edge function URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const functionUrl = `${supabaseUrl}/functions/v1/youtube-download`;

      setProgress(30);
      console.log("Starting direct download from edge function...");

      // Make direct fetch request to get the binary stream
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

      setProgress(50);

      // Check if we got JSON (error) or binary (success)
      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        // It's an error response
        const data = await response.json();
        if (data.error) {
          setError(data.error);
          return {
            success: false,
            error: data.error,
          };
        }
      }

      if (!response.ok) {
        throw new Error(`Erro no servidor: ${response.status}`);
      }

      setProgress(60);

      // Get file info from headers
      const contentLength = response.headers.get("content-length");
      const contentDisposition = response.headers.get("content-disposition");
      
      let filename = `video.${audioOnly ? "mp3" : "mp4"}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) {
          filename = match[1];
        }
      }

      console.log(`Downloading: ${filename}, Size: ${contentLength} bytes`);

      // Read the response as blob with progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Não foi possível ler a resposta");
      }

      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      const chunks: Uint8Array[] = [];
      let receivedSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedSize += value.length;
        setDownloadedSize(receivedSize);
        
        // Update progress (60-95% for download)
        if (totalSize > 0) {
          const downloadProgress = 60 + (receivedSize / totalSize) * 35;
          setProgress(Math.min(95, downloadProgress));
        } else {
          // If we don't know total size, show incremental progress
          setProgress(Math.min(95, 60 + (chunks.length * 2)));
        }
      }

      setProgress(96);

      // Combine chunks into blob
      const blobParts: BlobPart[] = chunks.map(chunk => chunk.buffer as ArrayBuffer);
      const blob = new Blob(blobParts, { 
        type: audioOnly ? "audio/mpeg" : "video/mp4" 
      });

      console.log(`Download complete! Total size: ${blob.size} bytes`);

      if (blob.size === 0) {
        throw new Error("Arquivo vazio recebido");
      }

      setProgress(98);

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
        title: filename,
        fileSize: blob.size,
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
      setTimeout(() => {
        setProgress(0);
        setDownloadedSize(0);
      }, 3000);
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
    downloadedSize,
    formatFileSize,
  };
};
