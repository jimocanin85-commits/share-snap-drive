import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

const SlideshowPage = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndPreloadImages = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-images');
        
        if (error) throw error;
        
        if (data?.images && data.images.length > 0) {
          const imageUrls = data.images.map((img: any) => img.url);
          
          // Only preload first image on initial load
          if (images.length === 0) {
            const firstImage = new Image();
            firstImage.src = imageUrls[0];
            await new Promise((resolve) => {
              firstImage.onload = resolve;
              firstImage.onerror = resolve;
            });
            setLoading(false);
          }
          
          // Set images (will update with new images if any)
          setImages(imageUrls);
          
          // Continue preloading rest in background
          imageUrls.forEach((url: string) => {
            const img = new Image();
            img.src = url;
          });
        } else {
          setError('No images found');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching images:', err);
        setError('Failed to load images');
        setLoading(false);
      }
    };

    // Initial fetch
    fetchAndPreloadImages();
    
    // Refresh every 30 seconds to get new images
    const refreshInterval = setInterval(fetchAndPreloadImages, 30000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-lg text-muted-foreground">{error || 'No images to display'}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <img
        key={currentIndex}
        src={images[currentIndex]}
        alt={`Slide ${currentIndex + 1}`}
        className="w-full h-full object-cover animate-fade-in"
      />
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        <Button
          onClick={toggleFullscreen}
          size="icon"
          variant="secondary"
          className="bg-black/50 hover:bg-black/70 text-white border-none"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

export default SlideshowPage;
