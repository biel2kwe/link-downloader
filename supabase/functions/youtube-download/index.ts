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

// List of public cobalt instances that don't require auth
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
            filename: data.filename || "video.mp4",
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
      
      console.log(`Streaming file: ${contentType}, size: ${contentLength}`);

      // Stream the response
      return new Response(downloadResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          ...(contentLength ? { "Content-Length": contentLength } : {}),
        },
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
