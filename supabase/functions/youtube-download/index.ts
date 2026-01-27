import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DownloadRequest {
  url: string;
  quality?: string;
  audioOnly?: boolean;
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

// Sanitize filename
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100)
    .trim() || 'video';
}

// Cobalt instances - prioritize ones that return redirect URLs
const COBALT_INSTANCES = [
  "https://api.cobalt.tools",
  "https://cobalt-api.kwiatekmiki.com",
];

// Get download URL from Cobalt API - ONLY accept redirect URLs
async function getCobaltRedirectUrl(
  youtubeUrl: string,
  quality: string,
  audioOnly: boolean
): Promise<{ url: string; filename?: string } | null> {
  
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
      console.log(`Cobalt response from ${instance}:`, JSON.stringify(data).substring(0, 300));

      // ONLY accept "redirect" status - these work with direct browser download
      if (data.status === "redirect" && data.url) {
        console.log(`Got REDIRECT URL from ${instance} - this will work!`);
        return { 
          url: data.url, 
          filename: data.filename,
        };
      }

      // Handle picker response - check if any have redirect URLs
      if (data.status === "picker" && data.picker && data.picker.length > 0) {
        for (const option of data.picker) {
          if (option.url && !option.url.includes('/tunnel')) {
            console.log(`Got picker URL from ${instance}`);
            return { 
              url: option.url, 
              filename: data.filename,
            };
          }
        }
      }

      // Skip tunnel URLs - they don't work with direct download
      if (data.status === "tunnel") {
        console.log(`Instance ${instance} returned tunnel URL - skipping (0 bytes issue)`);
        continue;
      }

    } catch (error) {
      console.log(`Error with ${instance}:`, error);
      continue;
    }
  }

  return null;
}

// Generate external service URLs as fallback
function getExternalServiceUrls(videoId: string): Array<{name: string; url: string}> {
  return [
    {
      name: "Y2Mate",
      url: `https://www.y2mate.com/youtube/${videoId}`,
    },
    {
      name: "SaveFrom",
      url: `https://en.savefrom.net/1-youtube-video-downloader-438/#url=https://youtube.com/watch?v=${videoId}`,
    },
    {
      name: "SSYouTube",
      url: `https://ssyoutube.com/watch?v=${videoId}`,
    },
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DownloadRequest = await req.json();
    const { url, quality = "720", audioOnly = false } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing: ${url}, quality: ${quality}, audioOnly: ${audioOnly}`);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "URL do YouTube inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get video info
    const videoInfo = await getVideoInfo(videoId);
    const safeTitle = sanitizeFilename(videoInfo?.title || "video");
    const extension = audioOnly ? "mp3" : "mp4";
    const filename = `${safeTitle}.${extension}`;

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Try to get a working redirect URL from Cobalt
    const cobaltResult = await getCobaltRedirectUrl(youtubeUrl, quality, audioOnly);

    if (cobaltResult && cobaltResult.url) {
      console.log(`Success! Returning redirect URL: ${cobaltResult.url.substring(0, 100)}...`);
      
      return new Response(
        JSON.stringify({
          success: true,
          downloadUrl: cobaltResult.url,
          filename: filename,
          title: videoInfo?.title || "video",
          method: "direct",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: return external service URLs
    console.log("Cobalt failed to provide working URL, returning external services");
    const externalServices = getExternalServiceUrls(videoId);

    return new Response(
      JSON.stringify({
        success: true,
        method: "external",
        title: videoInfo?.title || "video",
        filename: filename,
        externalServices: externalServices,
        message: "Use um dos serviços abaixo para baixar o vídeo",
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
