import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Maximize, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const SlideshowPage = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        const { data, error } = await supabase.functions.invoke('get-images', {
          body: {}
        });
        
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
        
        // Retry up to 5 times on initial load with longer delays to handle cold starts
        if (images.length === 0 && retryCount < 5) {
          const delay = Math.min(5000 * (retryCount + 1), 15000); // 5s, 10s, 15s, 15s, 15s
          console.log(`Retrying in ${delay/1000} seconds... (attempt ${retryCount + 1}/5)`);
          setTimeout(() => fetchAndPreloadImages(retryCount + 1), delay);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('Manual refresh triggered');
      const { data, error } = await supabase.functions.invoke('get-images', {
        body: {}
      });
      
      if (error) {
        console.error('Refresh error:', error);
        throw error;
      }
      
      if (data?.images && data.images.length > 0) {
        const imageUrls = data.images.map((img: any) => img.url);
        setImages(imageUrls);
        setCurrentIndex(0);
        console.log(`Refreshed: ${imageUrls.length} images loaded`);
      }
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setRefreshing(false);
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
        className="w-full h-full object-contain md:object-cover animate-fade-in"
      />
      <div className="absolute bottom-safe inset-x-0 pb-4 px-4 flex items-center justify-center gap-2 md:bottom-4 md:right-4 md:left-auto md:justify-end">
        <Button
          onClick={handleRefresh}
          size="icon"
          variant="secondary"
          disabled={refreshing}
          className="bg-black/70 hover:bg-black/90 text-white border-none h-12 w-12 md:h-10 md:w-10 touch-manipulation"
        >
          <RefreshCw className={`h-5 w-5 md:h-4 md:w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          onClick={toggleFullscreen}
          size="icon"
          variant="secondary"
          className="bg-black/70 hover:bg-black/90 text-white border-none h-12 w-12 md:h-10 md:w-10 touch-manipulation"
        >
          <Maximize className="h-5 w-5 md:h-4 md:w-4" />
        </Button>
        <div className="bg-black/70 text-white px-4 py-2 md:px-3 md:py-1 rounded-full text-base md:text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

export default SlideshowPage;
