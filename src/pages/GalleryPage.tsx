import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, X, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CloudinaryImage {
  thumbnail: string;
  url: string;
  publicId: string;
}

const GalleryPage = () => {
  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; index: number } | null>(null);
  const { toast } = useToast();

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-images");
      
      if (error) throw error;
      
      if (data?.images && Array.isArray(data.images)) {
        setImages(data.images);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
      toast({
        title: "Error",
        description: "Failed to load images",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      
      if (e.key === "ArrowLeft") {
        navigatePrevious();
      } else if (e.key === "ArrowRight") {
        navigateNext();
      } else if (e.key === "Escape") {
        setSelectedImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, images]);

  const navigateNext = () => {
    if (!selectedImage) return;
    const nextIndex = (selectedImage.index + 1) % images.length;
    setSelectedImage({ url: images[nextIndex].url, index: nextIndex });
  };

  const navigatePrevious = () => {
    if (!selectedImage) return;
    const prevIndex = selectedImage.index === 0 ? images.length - 1 : selectedImage.index - 1;
    setSelectedImage({ url: images[prevIndex].url, index: prevIndex });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchImages();
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      // Detect iOS devices
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        // For iOS: Open image in new window so user can long-press to save
        window.open(url, '_blank');
        toast({
          title: "Billede åbnet",
          description: "Hold fingeren på billedet og vælg 'Gem billede' for at gemme det i dit bibliotek",
        });
      } else {
        // For Android and desktop: Direct download
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `billede-${index + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        toast({
          title: "Success",
          description: "Billede downloadet",
        });
      }
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke downloade billede",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Indlæser billeder...</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Ingen billeder fundet</p>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div 
              key={image.publicId} 
              className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
              onClick={() => setSelectedImage({ url: image.url, index })}
            >
              <img
                src={image.thumbnail}
                alt={`Billede ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-12 w-12 text-white" />
              </div>
              <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                {index + 1} / {images.length}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            <X className="h-6 w-6" />
          </Button>
          
          {/* Previous Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white h-12 w-12"
            onClick={(e) => {
              e.stopPropagation();
              navigatePrevious();
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          {/* Next Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white h-12 w-12"
            onClick={(e) => {
              e.stopPropagation();
              navigateNext();
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>

          <Button
            variant="default"
            size="lg"
            className="absolute bottom-4 right-4 z-50 gap-2"
            onClick={(e) => {
              e.stopPropagation();
              downloadImage(selectedImage.url, selectedImage.index);
            }}
          >
            <Download className="h-5 w-5" />
            Download
          </Button>
          <div className="absolute top-4 left-4 z-50 bg-black/70 text-white px-3 py-2 rounded text-sm">
            {selectedImage.index + 1} / {images.length}
          </div>
          <img
            src={selectedImage.url}
            alt={`Billede ${selectedImage.index + 1}`}
            className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] w-auto h-auto object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
