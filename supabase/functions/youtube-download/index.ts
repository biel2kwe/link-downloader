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

// Multiple cobalt instances to try
const COBALT_INSTANCES = [
  { url: "https://cobalt-api.kwiatekmiki.com" },
  { url: "https://api.cobalt.tools" },
];

interface CobaltResult {
  downloadUrl: string;
  filename: string;
  status: string;
}

async function tryCobaltInstance(
  instance: { url: string },
  videoUrl: string,
  quality: string,
  audioOnly: boolean
): Promise<CobaltResult | null> {
  try {
    console.log(`Trying cobalt instance: ${instance.url}`);
    
    const response = await fetch(`${instance.url}/`, {
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
        filenameStyle: "basic", // Use basic for cleaner filenames
      }),
    });

    const responseText = await response.text();
    console.log(`Instance ${instance.url} response: ${response.status} - ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      return null;
    }

    const data = JSON.parse(responseText);
    
    if (data.url) {
      return {
        downloadUrl: data.url,
        filename: data.filename || `video.${audioOnly ? "mp3" : "mp4"}`,
        status: data.status || "unknown",
      };
    }

    // Handle picker response (multiple formats available)
    if (data.picker && data.picker.length > 0) {
      return {
        downloadUrl: data.picker[0].url,
        filename: `video.${audioOnly ? "mp3" : "mp4"}`,
        status: "picker",
      };
    }

    return null;
  } catch (error) {
    console.log(`Instance ${instance.url} error:`, error);
    return null;
  }
}

// Try to get video info from YouTube oEmbed
async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (response.ok) {
      const data = await response.json();
      return data.title?.replace(/[^\w\s-]/g, "").substring(0, 50) || "video";
    }
  } catch (e) {
    console.log("Failed to get video title:", e);
  }
  return "video";
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

    // Extract video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    // Try each cobalt instance
    for (const instance of COBALT_INSTANCES) {
      const result = await tryCobaltInstance(instance, url, quality, audioOnly);
      
      if (result) {
        console.log(`Success from ${instance.url}: ${result.status}`);
        
        // Get video title for filename
        let filename = result.filename;
        if (videoId && filename === `video.${audioOnly ? "mp3" : "mp4"}`) {
          const title = await getVideoTitle(videoId);
          filename = `${title}.${audioOnly ? "mp3" : "mp4"}`;
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            downloadUrl: result.downloadUrl,
            filename: filename.replace(/[^\w\s.-]/g, "_"),
            status: result.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: use y2mate alternative
    if (videoId) {
      console.log("All instances failed, using fallback");
      return new Response(
        JSON.stringify({
          success: true,
          downloadUrl: `https://www.y2mate.com/youtube/${videoId}`,
          filename: "video.mp4",
          status: "external",
          isExternal: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Não foi possível processar o vídeo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
