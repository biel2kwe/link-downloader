import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DownloadRequest {
  url: string;
  audioOnly?: boolean;
  quality?: string;
}

// List of public Cobalt API instances (from instances.cobalt.best)
const COBALT_INSTANCES = [
  "https://cobalt-backend.canine.tools",
  "https://cobalt-api.meowing.de",
  "https://cobalt-api.kwiatekmiki.com",
  "https://kityune.imput.net",
  "https://nachos.imput.net",
  "https://sunny.imput.net",
  "https://blossom.imput.net",
  "https://capi.3kh0.net",
];

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

// Map quality to Cobalt's videoQuality format
function mapQuality(quality?: string): string {
  if (!quality) return "1080";
  
  const qualityMap: Record<string, string> = {
    "360p": "360",
    "480p": "480",
    "720p": "720",
    "1080p": "1080",
    "1440p": "1440",
    "2160p": "2160",
    "4k": "2160",
    "max": "max",
  };
  
  return qualityMap[quality.toLowerCase()] || "1080";
}

// Try to get download URL from a Cobalt instance
async function tryInstance(
  instance: string,
  youtubeUrl: string,
  audioOnly: boolean,
  quality: string
): Promise<{ success: boolean; url?: string; filename?: string; error?: string }> {
  try {
    console.log(`Trying instance: ${instance}`);
    
    const requestBody: Record<string, unknown> = {
      url: youtubeUrl,
      videoQuality: quality,
      audioFormat: "mp3",
      audioBitrate: "320",
      filenameStyle: "pretty",
      youtubeVideoCodec: "h264",
    };

    if (audioOnly) {
      requestBody.downloadMode = "audio";
    }

    const response = await fetch(instance, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Instance ${instance} returned error: ${response.status} - ${errorText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log(`Instance ${instance} response:`, JSON.stringify(data));

    // Handle different response statuses
    if (data.status === "tunnel" || data.status === "redirect") {
      return {
        success: true,
        url: data.url,
        filename: data.filename,
      };
    }

    if (data.status === "picker" && data.picker && data.picker.length > 0) {
      // Return the first available option
      const firstOption = data.picker[0];
      return {
        success: true,
        url: firstOption.url,
        filename: data.filename || "video",
      };
    }

    if (data.status === "local-processing" && data.tunnel && data.tunnel.length > 0) {
      // For local processing, return the first tunnel URL
      return {
        success: true,
        url: data.tunnel[0],
        filename: data.output?.filename || "video",
      };
    }

    if (data.status === "error") {
      console.log(`Instance ${instance} returned error status:`, data.error);
      return { success: false, error: data.error?.code || "Unknown error" };
    }

    // If we got a URL directly (some older API versions)
    if (data.url) {
      return {
        success: true,
        url: data.url,
        filename: data.filename,
      };
    }

    return { success: false, error: "Unknown response format" };

  } catch (e) {
    console.log(`Instance ${instance} failed with exception:`, e);
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
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

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const mappedQuality = mapQuality(quality);

    // Get video info for display
    const videoInfo = await getVideoInfo(videoId);
    console.log(`Video info: ${videoInfo?.title || "unknown"}`);

    // Try each Cobalt instance until one works
    let lastError = "";
    for (const instance of COBALT_INSTANCES) {
      const result = await tryInstance(instance, youtubeUrl, audioOnly, mappedQuality);
      
      if (result.success && result.url) {
        console.log(`Success! Got download URL from ${instance}`);
        
        return new Response(
          JSON.stringify({
            success: true,
            videoId,
            title: videoInfo?.title || "Vídeo do YouTube",
            author: videoInfo?.author || "",
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            downloadUrl: result.url,
            filename: result.filename || `${videoInfo?.title || videoId}.${audioOnly ? "mp3" : "mp4"}`,
            source: instance,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      lastError = result.error || "Unknown error";
    }

    // If all instances failed, return fallback services
    console.log("All Cobalt instances failed, returning fallback services");
    
    const fallbackServices = [
      {
        name: "Cobalt.tools",
        url: `https://cobalt.tools/?u=${encodeURIComponent(youtubeUrl)}`,
        description: "Site oficial do Cobalt - cole o link e baixe",
      },
      {
        name: "Y2Mate",
        url: `https://www.y2mate.com/youtube/${videoId}`,
        description: "Download em várias qualidades",
      },
      {
        name: "SaveFrom",
        url: `https://en.savefrom.net/1-youtube-video-downloader-438/#url=${encodeURIComponent(youtubeUrl)}`,
        description: "Serviço alternativo de download",
      },
    ];

    return new Response(
      JSON.stringify({
        success: false,
        videoId,
        title: videoInfo?.title || "Vídeo do YouTube",
        author: videoInfo?.author || "",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        error: `APIs indisponíveis: ${lastError}`,
        fallbackServices,
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
