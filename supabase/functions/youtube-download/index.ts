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

// Public Invidious instances with API enabled
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.private.coffee",
  "https://iv.ggtyler.dev",
  "https://invidious.protokolla.fi",
  "https://invidious.perennialte.ch",
  "https://yt.drgnz.club",
  "https://invidious.darkness.services",
  "https://invidious.einfachzocken.eu",
  "https://invidious.privacyredirect.com",
  "https://invidious.drgns.space",
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

// Get video info and streams from Invidious API
async function getVideoFromInvidious(
  instance: string,
  videoId: string
): Promise<{
  success: boolean;
  title?: string;
  author?: string;
  formatStreams?: Array<{
    url: string;
    itag: string;
    type: string;
    quality: string;
    container: string;
    resolution?: string;
  }>;
  adaptiveFormats?: Array<{
    url: string;
    itag: string;
    type: string;
    bitrate: string;
    container: string;
    resolution?: string;
    audioQuality?: string;
    audioSampleRate?: string;
  }>;
  error?: string;
}> {
  try {
    console.log(`Trying Invidious instance: ${instance}`);
    
    const response = await fetch(
      `${instance}/api/v1/videos/${videoId}?local=true`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!response.ok) {
      console.log(`Instance ${instance} returned ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.error) {
      console.log(`Instance ${instance} returned error:`, data.error);
      return { success: false, error: data.error };
    }

    return {
      success: true,
      title: data.title,
      author: data.author,
      formatStreams: data.formatStreams || [],
      adaptiveFormats: data.adaptiveFormats || [],
    };
  } catch (e) {
    console.log(`Instance ${instance} failed:`, e);
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Find best video stream based on quality preference
function findBestVideoStream(
  formatStreams: Array<any>,
  adaptiveFormats: Array<any>,
  preferredQuality?: string
): { url: string; quality: string; type: string } | null {
  // Priority order for quality
  const qualityPriority = ["1080p", "720p", "480p", "360p", "240p", "144p"];
  
  if (preferredQuality) {
    // Try to find the preferred quality first
    const normalizedPref = preferredQuality.replace("p", "");
    qualityPriority.unshift(`${normalizedPref}p`);
  }

  // First try formatStreams (combined audio+video, easier to play)
  for (const quality of qualityPriority) {
    const stream = formatStreams.find((s: any) => 
      s.resolution === quality || s.qualityLabel === quality || s.quality === quality
    );
    if (stream?.url) {
      return {
        url: stream.url,
        quality: stream.resolution || stream.qualityLabel || stream.quality || "unknown",
        type: stream.type || "video/mp4",
      };
    }
  }

  // If no format streams, try adaptive formats (video only)
  for (const quality of qualityPriority) {
    const stream = adaptiveFormats.find((s: any) => 
      s.type?.startsWith("video/") && 
      (s.resolution === quality || s.qualityLabel === quality)
    );
    if (stream?.url) {
      return {
        url: stream.url,
        quality: stream.resolution || stream.qualityLabel || "unknown",
        type: stream.type || "video/mp4",
      };
    }
  }

  // Fallback: return first available video stream
  const firstVideo = formatStreams[0] || adaptiveFormats.find((s: any) => s.type?.startsWith("video/"));
  if (firstVideo?.url) {
    return {
      url: firstVideo.url,
      quality: firstVideo.resolution || firstVideo.qualityLabel || firstVideo.quality || "unknown",
      type: firstVideo.type || "video/mp4",
    };
  }

  return null;
}

// Find best audio stream
function findBestAudioStream(
  adaptiveFormats: Array<any>
): { url: string; quality: string; type: string } | null {
  // Find audio streams sorted by bitrate (highest first)
  const audioStreams = adaptiveFormats
    .filter((s: any) => s.type?.startsWith("audio/"))
    .sort((a: any, b: any) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

  if (audioStreams.length > 0) {
    const best = audioStreams[0];
    return {
      url: best.url,
      quality: best.audioQuality || `${Math.round(parseInt(best.bitrate) / 1000)}kbps` || "unknown",
      type: best.type || "audio/mp4",
    };
  }

  return null;
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

    // Try each Invidious instance until one works
    let lastError = "";
    for (const instance of INVIDIOUS_INSTANCES) {
      const result = await getVideoFromInvidious(instance, videoId);
      
      if (result.success) {
        console.log(`Got video info from ${instance}: "${result.title}"`);
        
        let stream;
        if (audioOnly) {
          stream = findBestAudioStream(result.adaptiveFormats || []);
        } else {
          stream = findBestVideoStream(
            result.formatStreams || [],
            result.adaptiveFormats || [],
            quality
          );
        }

        if (stream) {
          console.log(`Found stream: ${stream.quality}, type: ${stream.type}`);
          
          // Determine file extension
          const extension = audioOnly ? "mp3" : (stream.type.includes("webm") ? "webm" : "mp4");
          const safeTitle = (result.title || videoId)
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
          
          return new Response(
            JSON.stringify({
              success: true,
              videoId,
              title: result.title || "Vídeo do YouTube",
              author: result.author || "",
              thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              downloadUrl: stream.url,
              quality: stream.quality,
              type: stream.type,
              filename: `${safeTitle}.${extension}`,
              source: instance,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log(`No suitable stream found from ${instance}`);
          lastError = "Nenhum stream disponível";
        }
      } else {
        lastError = result.error || "Unknown error";
      }
    }

    // If all instances failed, return fallback services
    console.log("All Invidious instances failed, returning fallback services");
    
    // Get video title from oEmbed as fallback
    let videoTitle = "Vídeo do YouTube";
    try {
      const oembedResponse = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        videoTitle = oembedData.title || videoTitle;
      }
    } catch (e) {
      console.log("Failed to get oEmbed data:", e);
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const fallbackServices = [
      {
        name: "Cobalt.tools",
        url: `https://cobalt.tools/?u=${encodeURIComponent(youtubeUrl)}`,
        description: "Cole o link e baixe diretamente",
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
        title: videoTitle,
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
