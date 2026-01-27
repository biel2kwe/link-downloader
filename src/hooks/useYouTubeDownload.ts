import { useState } from "react";

interface FallbackService {
  name: string;
  url: string;
  description: string;
}

interface DownloadResult {
  success: boolean;
  title?: string;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  fallbackServices?: FallbackService[];
  fileSize?: number;
}

export const useYouTubeDownload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackServices, setFallbackServices] = useState<FallbackService[]>([]);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [fileSize, setFileSize] = useState<number>(0);

  const processVideo = async (
    url: string,
    audioOnly: boolean,
    quality?: string
  ): Promise<DownloadResult> => {
    setIsProcessing(true);
    setError(null);
    setFallbackServices([]);
    setVideoTitle("");
    setDownloadProgress(0);
    setFileSize(0);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/youtube-download`;

      console.log("Requesting download from edge function...");

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          url,
          audioOnly,
          quality,
        }),
      });

      const contentType = response.headers.get("Content-Type") || "";
      
      // Check if response is JSON (error or fallback) or binary (video/audio)
      if (contentType.includes("application/json")) {
        const data = await response.json();
        console.log("Edge function response:", data);

        if (data.error && !data.fallbackServices) {
          setError(data.error);
          return { success: false, error: data.error };
        }

        setVideoTitle(data.title || "");

        // If we got fallback services
        if (data.fallbackServices && data.fallbackServices.length > 0) {
          setFallbackServices(data.fallbackServices);
          setError(data.error || "Use um serviço alternativo");
          return {
            success: false,
            title: data.title,
            error: data.error,
            fallbackServices: data.fallbackServices,
          };
        }

        setError("Nenhum serviço de download disponível");
        return { success: false, error: "Nenhum serviço de download disponível" };
      }

      // Response is binary - this is the actual file!
      console.log("Received binary data, downloading...");
      
      const contentLength = response.headers.get("Content-Length");
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      setFileSize(totalSize);
      
      // Get filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : (audioOnly ? "audio.mp3" : "video.mp4");
      
      setVideoTitle(filename.replace(/\.[^.]+$/, '').replace(/_/g, ' '));

      // Read the response as a blob
      const blob = await response.blob();
      
      console.log(`Blob size: ${blob.size} bytes`);
      setFileSize(blob.size);
      setDownloadProgress(100);

      if (blob.size === 0) {
        throw new Error("Arquivo vazio recebido");
      }

      // Create download URL and trigger download
      const downloadUrl = URL.createObjectURL(blob);
      
      // Trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);

      return {
        success: true,
        title: filename,
        filename,
        fileSize: blob.size,
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao processar";
      console.error("Process error:", err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  };

  const openService = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const reset = () => {
    setFallbackServices([]);
    setVideoTitle("");
    setError(null);
    setDownloadProgress(0);
    setFileSize(0);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return {
    processVideo,
    isProcessing,
    error,
    fallbackServices,
    videoTitle,
    downloadProgress,
    fileSize,
    formatFileSize,
    openService,
    reset,
  };
};
