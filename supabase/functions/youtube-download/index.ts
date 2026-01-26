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
          // Clean filename for display
          const filename = (data.filename || "video.mp4")
            .replace(/[^\w\s\-\.\(\)]/g, "")
            .trim() || "video.mp4";
            
          return {
            url: data.url,
            filename: filename,
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
    const { url, quality = "1080", audioOnly = false } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing: ${url}, quality: ${quality}, audioOnly: ${audioOnly}`);

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

    // Return the direct download URL from Cobalt
    // The tunnel URL works when accessed directly by the browser
    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: result.url,
        filename: result.filename,
        status: "ready",
        directDownload: true,
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
