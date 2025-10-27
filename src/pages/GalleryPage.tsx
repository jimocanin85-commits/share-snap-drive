import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, RefreshCw, X, Maximize2 } from "lucide-react";
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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchImages();
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `image-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      toast({
        title: "Success",
        description: "Image downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Error",
        description: "Failed to download image",
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

      {/* Fullscreen Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] p-0 m-0 border-0 bg-black [&>button]:hidden">
          {selectedImage && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
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
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GalleryPage;
