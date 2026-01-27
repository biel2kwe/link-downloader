import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DownloadRequest {
  url: string;
  quality?: string;
  audioOnly?: boolean;
  action?: "info" | "download";
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

// Get video info from YouTube oEmbed
async function getVideoInfo(videoId: string): Promise<{ title: string; author: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || "video",
        author: data.author_name || "unknown",
      };
    }
  } catch (e) {
    console.log("Failed to get video info:", e);
  }
  return null;
}

// Sanitize filename for Content-Disposition header
function sanitizeFilename(filename: string): string {
  // Remove or replace problematic characters
  return filename
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100)
    .trim() || 'video';
}

// List of working Cobalt API instances
const COBALT_INSTANCES = [
  "https://cobalt-api.kwiatekmiki.com",
  "https://cobalt-api.meowing.de",
  "https://cobalt-backend.canine.tools",
  "https://kityune.imput.net",
  "https://nachos.imput.net",
  "https://sunny.imput.net",
  "https://blossom.imput.net",
  "https://capi.3kh0.net",
];

// Get download URL from Cobalt API
async function getCobaltDownload(
  youtubeUrl: string,
  quality: string,
  audioOnly: boolean
): Promise<{ url: string; filename?: string; isTunnel: boolean } | null> {
  
  const qualityMap: Record<string, string> = {
    "2160": "2160",
    "1080": "1080",
    "720": "720",
    "480": "480",
    "360": "360",
  };

  const videoQuality = qualityMap[quality] || "720";

  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      
      const response = await fetch(`${instance}/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: youtubeUrl,
          videoQuality: videoQuality,
          audioFormat: "mp3",
          filenameStyle: "pretty",
          downloadMode: audioOnly ? "audio" : "auto",
        }),
      });

      if (!response.ok) {
        console.log(`Instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`Cobalt response from ${instance}:`, JSON.stringify(data).substring(0, 200));

      // Handle tunnel status - we can proxy these server-side!
      if (data.status === "tunnel" && data.url) {
        console.log(`Got tunnel URL from ${instance} - will proxy server-side`);
        return { 
          url: data.url, 
          filename: data.filename,
          isTunnel: true
        };
      }

      // Handle redirect status - direct URLs
      if (data.status === "redirect" && data.url) {
        console.log(`Got redirect URL from ${instance}`);
        return { 
          url: data.url, 
          filename: data.filename,
          isTunnel: false
        };
      }

      // Handle picker response
      if (data.status === "picker" && data.picker && data.picker.length > 0) {
        const firstOption = data.picker[0];
        if (firstOption.url) {
          console.log(`Got picker URL from ${instance}`);
          return { 
            url: firstOption.url, 
            filename: data.filename,
            isTunnel: false
          };
        }
      }

      // Direct URL response
      if (data.url) {
        return { 
          url: data.url, 
          filename: data.filename,
          isTunnel: data.status === "tunnel"
        };
      }

    } catch (error) {
      console.log(`Error with ${instance}:`, error);
      continue;
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DownloadRequest = await req.json();
    const { url, quality = "720", audioOnly = false, action = "download" } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing: ${url}, quality: ${quality}, audioOnly: ${audioOnly}, action: ${action}`);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "URL do YouTube inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get video info for the title
    const videoInfo = await getVideoInfo(videoId);
    const safeTitle = sanitizeFilename(videoInfo?.title || "video");
    const extension = audioOnly ? "mp3" : "mp4";

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Get download URL from Cobalt
    const cobaltResult = await getCobaltDownload(youtubeUrl, quality, audioOnly);

    if (!cobaltResult || !cobaltResult.url) {
      console.log("Cobalt failed to return download URL");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível obter o link de download. Tente novamente.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If action is "info", just return the metadata
    if (action === "info") {
      return new Response(
        JSON.stringify({
          success: true,
          videoId: videoId,
          title: videoInfo?.title || "video",
          author: videoInfo?.author || "Unknown",
          hasDownload: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the download URL directly - let the browser handle it
    // Tunnel URLs don't work with server-side fetch (return 0 bytes)
    const filename = `${safeTitle}.${extension}`;
    
    console.log(`Returning download URL for browser: ${cobaltResult.url.substring(0, 100)}...`);
    
    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: cobaltResult.url,
        filename: filename,
        title: videoInfo?.title || "video",
        isTunnel: cobaltResult.isTunnel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

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
