import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const SlideshowPage = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-images');
        
        if (error) throw error;
        
        if (data?.images && data.images.length > 0) {
          setImages(data.images.map((img: any) => img.url));
        } else {
          setError('No images found');
        }
      } catch (err) {
        console.error('Error fetching images:', err);
        setError('Failed to load images');
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [images.length]);

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
        className="w-full h-full object-contain animate-fade-in"
      />
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
};

export default SlideshowPage;
