import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

const SlideshowPage = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent screen from sleeping - aggressive wake lock with fallback
  useEffect(() => {
    let wakeLock: any = null;
    let wakeLockInterval: NodeJS.Timeout | null = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake lock activated');
          
          // Re-request when released
          wakeLock.addEventListener('release', () => {
            console.log('Wake lock released, re-requesting...');
            setTimeout(requestWakeLock, 100);
          });
        }
      } catch (err) {
        console.error('Wake lock error:', err);
      }
    };

    // Initial request
    requestWakeLock();

    // Periodically re-request wake lock every 10 seconds as backup
    wakeLockInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    }, 10000);

    // Re-request wake lock on any user interaction
    const handleInteraction = () => requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('mousemove', handleInteraction);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release();
      }
      if (wakeLockInterval) {
        clearInterval(wakeLockInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('mousemove', handleInteraction);
    };
  }, []);

  useEffect(() => {
    const fetchAndPreloadImages = async (retryCount = 0) => {
      try {
        console.log(`Fetching images (attempt ${retryCount + 1})...`);
        const { data, error } = await supabase.functions.invoke('get-images');
        
        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }
        
        console.log('Received data:', data);
        
        if (data?.images && data.images.length > 0) {
          const imageUrls = data.images.map((img: any) => img.url);
          console.log(`Successfully fetched ${imageUrls.length} images`);
          
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
          
          // Clear any previous errors on successful fetch
          setError(null);
        } else {
          console.warn('No images in response');
          // Only show error on initial load
          if (images.length === 0) {
            setError('No images found');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching images:', err);
        
        // Retry up to 3 times on initial load
        if (images.length === 0 && retryCount < 3) {
          console.log(`Retrying in 2 seconds... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => fetchAndPreloadImages(retryCount + 1), 2000);
          return;
        }
        
        // Only show error on initial load after retries exhausted
        if (images.length === 0) {
          setError('Failed to load images. Please refresh the page.');
          setLoading(false);
        } else {
          console.log('Refresh failed, continuing with existing images');
        }
      }
    };

    // Initial fetch with retry
    fetchAndPreloadImages();
    
    // Refresh every 60 seconds (less aggressive)
    const refreshInterval = setInterval(() => fetchAndPreloadImages(), 60000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  const toggleFullscreen = () => {
    const elem = document.documentElement as any;
    
    if (!document.fullscreenElement && !elem.webkitFullscreenElement && !elem.mozFullScreenElement) {
      // Try standard API first, then webkit (Safari/Samsung), then moz (older Firefox)
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      }
    } else {
      // Exit fullscreen with vendor prefixes
      const doc = document as any;
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      }
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
