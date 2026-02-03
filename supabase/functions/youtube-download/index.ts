import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DownloadRequest {
  url: string;
  audioOnly?: boolean;
  quality?: string;
}

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get video title from oEmbed API
async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (response.ok) {
      const data = await response.json();
      return data.title || "video";
    }
  } catch (e) {
    console.log("Failed to get title:", e);
  }
  return "video";
}

// Sanitize filename
function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[^\x00-\x7F]/g, (char) => {
      const map: Record<string, string> = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c', 'ñ': 'n',
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ç': 'C', 'Ñ': 'N',
      };
      return map[char] || '';
    })
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DownloadRequest = await req.json();
    const { url, audioOnly = false, quality } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing URL: ${url}, audioOnly: ${audioOnly}, quality: ${quality}`);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "URL do YouTube inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get video title
    const videoTitle = await getVideoTitle(videoId);
    console.log(`Video title: ${videoTitle}`);

    try {
      // Use ytdl_core to get video info and stream
      console.log(`Fetching video info for: ${videoId}`);
      
      // Get stream from ytdl_core
      const stream = await ytdl(videoId, {
        filter: audioOnly ? "audioonly" : "audioandvideo",
        quality: audioOnly ? "highestaudio" : (quality === "1080" ? "highest" : "highest"),
      });

      console.log("Got stream from ytdl_core, collecting chunks...");

      // Collect all chunks
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
        totalSize += chunk.length;
        
        // Limit to 50MB to avoid timeout
        if (totalSize > 50 * 1024 * 1024) {
          console.log("File too large, stopping at 50MB");
          break;
        }
      }

      console.log(`Collected ${chunks.length} chunks, total size: ${totalSize} bytes`);

      if (totalSize === 0) {
        throw new Error("No data received from stream");
      }

      // Combine chunks into a single Uint8Array
      const videoData = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        videoData.set(chunk, offset);
        offset += chunk.length;
      }

      // Create safe filename
      const extension = audioOnly ? "mp3" : "mp4";
      const safeFilename = `${sanitizeFilename(videoTitle)}.${extension}`;
      
      console.log(`Sending file: ${safeFilename}, size: ${totalSize} bytes`);

      // Return the video data directly
      return new Response(videoData, {
        headers: {
          ...corsHeaders,
          "Content-Type": audioOnly ? "audio/mpeg" : "video/mp4",
          "Content-Length": totalSize.toString(),
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
        },
      });

    } catch (ytdlError) {
      console.error("ytdl_core error:", ytdlError);
      
      // Fallback: return external services
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const fallbackServices = [
        {
          name: "SSYoutube",
          url: `https://ssyoutube.com/pt/${videoId}`,
          description: "Baixe em várias qualidades",
        },
        {
          name: "Y2Mate",
          url: `https://www.y2mate.com/youtube/${videoId}`,
          description: "Download rápido e fácil",
        },
        {
          name: "SaveFrom",
          url: `https://en.savefrom.net/1-youtube-video-downloader-438/#url=${encodeURIComponent(youtubeUrl)}`,
          description: "Serviço alternativo",
        },
      ];

      return new Response(
        JSON.stringify({
          success: false,
          videoId,
          title: videoTitle,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          error: `Erro ao processar: ${ytdlError instanceof Error ? ytdlError.message : "Erro desconhecido"}`,
          fallbackServices,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
