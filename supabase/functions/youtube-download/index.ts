import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DownloadRequest {
  url: string;
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

// Generate download service URLs - these are reliable external services
function getDownloadServices(videoId: string, audioOnly: boolean): Array<{name: string; url: string; description: string}> {
  const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;
  
  const services = [
    {
      name: "SaveFrom.net",
      url: `https://en.savefrom.net/1-youtube-video-downloader-438/#url=${encodeURIComponent(youtubeUrl)}`,
      description: "Serviço confiável com múltiplas qualidades",
    },
    {
      name: "Y2Mate",
      url: `https://www.y2mate.com/youtube/${videoId}`,
      description: "Download rápido em várias resoluções",
    },
    {
      name: "SSYouTube",
      url: `https://ssyoutube.com/watch?v=${videoId}`,
      description: "Adicione 'ss' antes de youtube.com",
    },
    {
      name: "9xBuddy",
      url: `https://9xbuddy.com/process?url=${encodeURIComponent(youtubeUrl)}`,
      description: "Alternativa estável",
    },
  ];

  if (audioOnly) {
    // Add MP3-specific services at the beginning for audio
    services.unshift({
      name: "YTMP3.cc",
      url: `https://ytmp3.cc/youtube-to-mp3/?url=${encodeURIComponent(youtubeUrl)}`,
      description: "Especializado em conversão para MP3",
    });
  }

  return services;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DownloadRequest = await req.json();
    const { url, audioOnly = false } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing URL: ${url}, audioOnly: ${audioOnly}`);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "URL do YouTube inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get video info for display
    const videoInfo = await getVideoInfo(videoId);
    
    // Get download service URLs
    const downloadServices = getDownloadServices(videoId, audioOnly);

    console.log(`Returning ${downloadServices.length} download services for: ${videoInfo?.title || videoId}`);

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: videoInfo?.title || "Vídeo do YouTube",
        author: videoInfo?.author || "",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        downloadServices,
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
