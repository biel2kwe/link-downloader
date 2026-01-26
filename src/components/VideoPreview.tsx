

interface VideoPreviewProps {
  videoId: string;
  title?: string;
}

export const VideoPreview = ({ videoId, title }: VideoPreviewProps) => {
  return (
    <div className="glass-card overflow-hidden animate-float">
      <div className="relative aspect-video bg-secondary">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title || "YouTube video player"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
      {title && (
        <div className="p-4">
          <h3 className="font-semibold text-foreground line-clamp-2">{title}</h3>
        </div>
      )}
    </div>
  );
};
