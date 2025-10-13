import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const UploadPage = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/');
      if (!isValid) {
        toast.error(`${file.name} er ikke et gyldigt billede`);
      }
      return isValid;
    });
    setSelectedFiles(validFiles);
    setIsSuccess(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Vælg venligst billeder at uploade");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploader billeder...");
    
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const { data, error } = await supabase.functions.invoke('upload', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message || 'Upload fejlede');
      }

      setUploadStatus("✅ Tak! Dine billeder er modtaget.");
      setIsSuccess(true);
      toast.success(`${selectedFiles.length} billede${selectedFiles.length > 1 ? 'r' : ''} uploadet!`);
      
      // Clear selection after short delay
      setTimeout(() => {
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus("❌ Der opstod en fejl. Prøv venligst igen.");
      toast.error("Upload fejlede. Prøv igen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-card)] border-border/50 animate-fade-in">
        <div className="text-center space-y-6">
          {/* Logo placeholder */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-[var(--shadow-button)]">
              <ImageIcon className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Del dine billeder 📸
            </h1>
            <p className="text-muted-foreground">
              Vælg billeder fra din telefon og tryk Upload
            </p>
          </div>

          {/* File input */}
          <div className="space-y-4">
            <label 
              htmlFor="file-upload" 
              className="block cursor-pointer"
            >
              <div className="border-2 border-dashed border-border hover:border-primary rounded-lg p-8 transition-colors bg-secondary/20 hover:bg-secondary/40">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-foreground font-medium">
                  Klik for at vælge billeder
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG eller WEBP
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
              <div className="bg-secondary/50 rounded-lg p-4 text-left animate-fade-in">
                <p className="text-sm font-medium text-foreground mb-2">
                  Valgte billeder ({selectedFiles.length}):
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <p key={index} className="text-xs text-muted-foreground truncate">
                      • {file.name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-[var(--shadow-button)] transition-all"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Uploader...
                </span>
              ) : (
                "Upload billeder"
              )}
            </Button>

            {/* Status message */}
            {uploadStatus && (
              <div className={`p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
                isSuccess 
                  ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' 
                  : uploadStatus.includes('❌')
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                  : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400'
              }`}>
                {isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : uploadStatus.includes('❌') ? (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <p className="text-sm font-medium">{uploadStatus}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UploadPage;