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

// List of public cobalt instances that don't require auth
const COBALT_INSTANCES = [
  "https://cobalt.api.timelessnesses.me",
  "https://api.cobalt.best",
  "https://cobalt-api.kwiatekmiki.com",
];

async function tryInstance(instanceUrl: string, videoUrl: string, quality: string, audioOnly: boolean): Promise<Response | null> {
  try {
    console.log(`Trying instance: ${instanceUrl}`);
    
    const response = await fetch(`${instanceUrl}/`, {
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
      if (data.url || data.status === "redirect" || data.status === "stream") {
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    
    const text = await response.text();
    console.log(`Instance ${instanceUrl} failed:`, response.status, text);
    return null;
  } catch (error) {
    console.log(`Instance ${instanceUrl} error:`, error);
    return null;
  }
}

async function getVideoInfoFromNoembed(videoId: string): Promise<{ title: string; author: string } | null> {
  try {
    const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || "video",
        author: data.author_name || "unknown",
      };
    }
  } catch (error) {
    console.log("Noembed error:", error);
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, quality = "1080", audioOnly = false }: DownloadRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing download request for: ${url}, quality: ${quality}, audioOnly: ${audioOnly}`);

    // Extract video ID for fallback info
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    // Try each cobalt instance until one works
    for (const instance of COBALT_INSTANCES) {
      const result = await tryInstance(instance, url, quality, audioOnly);
      if (result) {
        const data = await result.json();
        console.log("Success from instance:", instance, JSON.stringify(data));
        
        return new Response(
          JSON.stringify({
            success: true,
            downloadUrl: data.url,
            filename: data.filename || "video",
            status: data.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If all instances fail, try SaveTube API
    console.log("All cobalt instances failed, trying SaveTube...");
    
    if (videoId) {
      try {
        const saveTubeResponse = await fetch("https://api.savetube.me/info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
          }),
        });

        if (saveTubeResponse.ok) {
          const saveTubeData = await saveTubeResponse.json();
          console.log("SaveTube response:", JSON.stringify(saveTubeData));
          
          if (saveTubeData.data?.formats) {
            // Find the best matching format
            const formats = saveTubeData.data.formats;
            const targetQuality = parseInt(quality);
            
            // Sort by quality and find best match
            const videoFormats = formats.filter((f: any) => f.hasVideo && (audioOnly ? false : true));
            const audioFormats = formats.filter((f: any) => f.hasAudio && !f.hasVideo);
            
            let selectedFormat = null;
            
            if (audioOnly) {
              selectedFormat = audioFormats[0];
            } else {
              // Find format closest to target quality
              selectedFormat = videoFormats.find((f: any) => f.quality?.includes(quality)) || videoFormats[0];
            }
            
            if (selectedFormat?.url) {
              return new Response(
                JSON.stringify({
                  success: true,
                  downloadUrl: selectedFormat.url,
                  filename: saveTubeData.data.title || "video",
                  status: "stream",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      } catch (saveTubeError) {
        console.log("SaveTube error:", saveTubeError);
      }
    }

    // Last resort: provide direct download link via y2mate style redirect
    if (videoId) {
      const videoInfo = await getVideoInfoFromNoembed(videoId);
      
      // Use ssyoutube as fallback
      const ssYoutubeUrl = `https://ssyoutube.com/watch?v=${videoId}`;
      
      return new Response(
        JSON.stringify({
          success: true,
          downloadUrl: ssYoutubeUrl,
          filename: videoInfo?.title || "video",
          status: "redirect",
          isExternal: true,
          message: "Abrindo página de download externa",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: "Não foi possível processar o vídeo",
        suggestion: "Tente novamente mais tarde ou use uma resolução diferente"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
