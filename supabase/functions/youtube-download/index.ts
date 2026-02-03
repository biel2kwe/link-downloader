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

    // Since cobalt tunnel doesn't work reliably, we'll provide direct download services
    // that the user can use in a new tab
    
    // Option 1: Use ssyoutube (works well for downloads)
    const ssyoutubeUrl = `https://ssyoutube.com/watch?v=${videoId}`;
    
    // Option 2: Use y2mate
    const y2mateUrl = `https://www.y2mate.com/youtube/${videoId}`;
    
    // Option 3: Use savefrom
    const savefromUrl = `https://en.savefrom.net/1-youtube-video-downloader-${videoId}`;

    console.log(`Providing download options for video: ${videoId}`);

    return new Response(
      JSON.stringify({
        success: true,
        videoId: videoId,
        title: safeTitle,
        author: videoInfo?.author || "Unknown",
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
        // Primary download URL
        downloadUrl: ssyoutubeUrl,
        filename: `${safeTitle}.${audioOnly ? "mp3" : "mp4"}`,
        quality: quality,
        audioOnly: audioOnly,
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
