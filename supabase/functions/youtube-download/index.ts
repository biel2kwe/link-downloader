import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DownloadRequest {
  url: string;
  quality?: string;
  audioOnly?: boolean;
  proxyDownload?: boolean;
}

// Sanitize filename to ASCII-safe characters
function sanitizeFilename(filename: string): string {
  // Replace common accented characters
  const accents: Record<string, string> = {
    "á": "a", "à": "a", "ã": "a", "â": "a", "ä": "a",
    "é": "e", "è": "e", "ê": "e", "ë": "e",
    "í": "i", "ì": "i", "î": "i", "ï": "i",
    "ó": "o", "ò": "o", "õ": "o", "ô": "o", "ö": "o",
    "ú": "u", "ù": "u", "û": "u", "ü": "u",
    "ç": "c", "ñ": "n",
    "Á": "A", "À": "A", "Ã": "A", "Â": "A", "Ä": "A",
    "É": "E", "È": "E", "Ê": "E", "Ë": "E",
    "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
    "Ó": "O", "Ò": "O", "Õ": "O", "Ô": "O", "Ö": "O",
    "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
    "Ç": "C", "Ñ": "N",
  };
  
  let sanitized = filename;
  for (const [accented, plain] of Object.entries(accents)) {
    sanitized = sanitized.split(accented).join(plain);
  }
  
  // Remove any remaining non-ASCII characters
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');
  
  // Replace problematic characters for filenames
  sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
  
  // Ensure it ends with proper extension
  if (!sanitized.match(/\.(mp4|mp3|webm|mkv)$/i)) {
    sanitized += '.mp4';
  }
  
  return sanitized || 'video.mp4';
}

// List of public cobalt instances
const COBALT_INSTANCES = [
  "https://cobalt-api.kwiatekmiki.com",
];

async function getCobaltDownloadUrl(videoUrl: string, quality: string, audioOnly: boolean): Promise<{ url: string; filename: string } | null> {
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying instance: ${instance}`);
      
      const response = await fetch(`${instance}/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: videoUrl,
          videoQuality: quality,
          audioFormat: "mp3",
          downloadMode: audioOnly ? "audio" : "auto",
          filenameStyle: "pretty",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Cobalt response:`, JSON.stringify(data));
        
        if (data.url) {
          return {
            url: data.url,
            filename: sanitizeFilename(data.filename || "video.mp4"),
          };
        }
      }
      
      const text = await response.text();
      console.log(`Instance ${instance} failed:`, response.status, text);
    } catch (error) {
      console.log(`Instance ${instance} error:`, error);
    }
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DownloadRequest = await req.json();
    const { url, quality = "1080", audioOnly = false, proxyDownload = false } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing: ${url}, quality: ${quality}, audioOnly: ${audioOnly}, proxy: ${proxyDownload}`);

    // Get download URL from Cobalt
    const result = await getCobaltDownloadUrl(url, quality, audioOnly);
    
    if (!result) {
      // Extract video ID for fallback
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      
      if (videoId) {
        return new Response(
          JSON.stringify({
            success: true,
            downloadUrl: `https://ssyoutube.com/watch?v=${videoId}`,
            filename: "video.mp4",
            isExternal: true,
            message: "Use o site externo para baixar",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Não foi possível obter link de download" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If proxy download is requested, stream the file through the edge function
    if (proxyDownload) {
      console.log(`Proxying download from: ${result.url}`);
      
      const downloadResponse = await fetch(result.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
        },
      });

      if (!downloadResponse.ok) {
        console.error(`Download failed: ${downloadResponse.status}`);
        return new Response(
          JSON.stringify({ 
            error: "Download failed", 
            status: downloadResponse.status 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const contentType = downloadResponse.headers.get("content-type") || (audioOnly ? "audio/mpeg" : "video/mp4");
      const contentLength = downloadResponse.headers.get("content-length");
      
      console.log(`Streaming file: ${contentType}, size: ${contentLength || 'unknown'}`);

      // Build response headers
      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      };
      
      if (contentLength && contentLength !== "0") {
        responseHeaders["Content-Length"] = contentLength;
      }

      // Stream the response
      return new Response(downloadResponse.body, {
        headers: responseHeaders,
      });
    }

    // Return the download URL for client to fetch via proxy
    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: result.url,
        filename: result.filename,
        status: "ready",
        requiresProxy: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to process download",
        suggestion: "Tente novamente ou use uma resolução diferente"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
