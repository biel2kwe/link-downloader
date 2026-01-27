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

// List of working Cobalt API instances (ordered by reliability)
const COBALT_INSTANCES = [
  "https://cobalt-api.meowing.de",
  "https://cobalt-api.kwiatekmiki.com",
  "https://cobalt-backend.canine.tools",
  "https://kityune.imput.net",
  "https://nachos.imput.net",
  "https://sunny.imput.net",
  "https://blossom.imput.net",
  "https://capi.3kh0.net",
];

// Try to get download URL from Cobalt API
async function getCobaltDownload(
  youtubeUrl: string,
  quality: string,
  audioOnly: boolean
): Promise<{ url: string; filename?: string; type?: string } | null> {
  
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
      console.log(`Cobalt response from ${instance}:`, JSON.stringify(data));

      // Handle redirect status - this gives direct downloadable URLs
      if (data.status === "redirect" && data.url) {
        console.log(`Got redirect URL from ${instance}`);
        return { 
          url: data.url, 
          filename: data.filename,
          type: "redirect"
        };
      }

      // Tunnel URLs don't work for direct browser downloads
      // Skip them and try next instance or fallback
      if (data.status === "tunnel") {
        console.log(`Got tunnel URL from ${instance} - skipping (not compatible with direct download)`);
        continue;
      }

      // Handle picker response (multiple formats available)
      if (data.status === "picker" && data.picker && data.picker.length > 0) {
        const firstOption = data.picker[0];
        if (firstOption.url) {
          console.log(`Got picker URL from ${instance}`);
          return { 
            url: firstOption.url, 
            filename: data.filename,
            type: "redirect"
          };
        }
      }

      // Direct URL response
      if (data.url && data.status !== "tunnel") {
        console.log(`Got direct URL from ${instance}`);
        return { 
          url: data.url, 
          filename: data.filename,
          type: "redirect"
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

    // Get video info for the title
    const videoInfo = await getVideoInfo(videoId);
    const safeTitle = videoInfo?.title
      ?.replace(/[^\w\s-]/g, "")
      ?.substring(0, 50)
      ?.trim() || "video";

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Try to get direct download URL from Cobalt
    const cobaltResult = await getCobaltDownload(youtubeUrl, quality, audioOnly);

    if (cobaltResult && cobaltResult.url) {
      console.log(`Successfully got download URL`);
      
      return new Response(
        JSON.stringify({
          success: true,
          videoId: videoId,
          title: safeTitle,
          author: videoInfo?.author || "Unknown",
          downloadUrl: cobaltResult.url,
          filename: cobaltResult.filename || `${safeTitle}.${audioOnly ? "mp3" : "mp4"}`,
          quality: quality,
          audioOnly: audioOnly,
          method: "direct",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: provide download service links
    console.log(`Cobalt failed, providing fallback services`);
    
    const ssyoutubeUrl = `https://ssyoutube.com/watch?v=${videoId}`;
    const y2mateUrl = `https://www.y2mate.com/youtube/${videoId}`;
    const savefromUrl = `https://en.savefrom.net/1-youtube-video-downloader-${videoId}`;

    return new Response(
      JSON.stringify({
        success: true,
        videoId: videoId,
        title: safeTitle,
        author: videoInfo?.author || "Unknown",
        downloadUrl: ssyoutubeUrl,
        downloadServices: [
          {
            name: "SSYoutube",
            url: ssyoutubeUrl,
            description: "Rápido e fácil",
          },
          {
            name: "Y2Mate",
            url: y2mateUrl,
            description: "Múltiplas qualidades",
          },
          {
            name: "SaveFrom",
            url: savefromUrl,
            description: "Alternativa confiável",
          },
        ],
        filename: `${safeTitle}.${audioOnly ? "mp3" : "mp4"}`,
        quality: quality,
        audioOnly: audioOnly,
        method: "fallback",
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
