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

    // Use Cobalt API for YouTube downloads
    const cobaltResponse = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        videoQuality: quality,
        audioFormat: "mp3",
        downloadMode: audioOnly ? "audio" : "auto",
        filenameStyle: "pretty",
      }),
    });

    if (!cobaltResponse.ok) {
      const errorText = await cobaltResponse.text();
      console.error("Cobalt API error:", cobaltResponse.status, errorText);
      
      // Try alternative API if Cobalt fails
      return await tryAlternativeDownload(url, quality, audioOnly, corsHeaders);
    }

    const cobaltData = await cobaltResponse.json();
    console.log("Cobalt response:", JSON.stringify(cobaltData));

    if (cobaltData.status === "error") {
      return await tryAlternativeDownload(url, quality, audioOnly, corsHeaders);
    }

    // Return the download URL
    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: cobaltData.url,
        filename: cobaltData.filename || "video",
        status: cobaltData.status,
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

async function tryAlternativeDownload(
  url: string, 
  quality: string, 
  audioOnly: boolean,
  corsHeaders: Record<string, string>
) {
  try {
    // Extract video ID from URL
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Could not extract video ID from URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use y2mate-like API through a public endpoint
    const apiUrl = `https://yt-api.p.rapidapi.com/dl?id=${videoId}`;
    
    // Note: This requires RapidAPI key - returning info to user
    return new Response(
      JSON.stringify({
        success: false,
        error: "Download service temporarily unavailable",
        videoId: videoId,
        suggestion: "Para downloads em massa, considere usar uma API paga como RapidAPI",
        alternativeUrl: `https://www.y2mate.com/youtube/${videoId}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Alternative download error:", error);
    return new Response(
      JSON.stringify({ 
        error: "All download methods failed",
        suggestion: "Tente novamente mais tarde"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
