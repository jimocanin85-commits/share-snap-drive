import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertCircle, X, ExternalLink, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import mbLogo from "@/assets/mb-logo.png";
import imageCompression from "browser-image-compression";
import { useNavigate } from "react-router-dom";

const UploadPage = () => {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check if more than 10 files selected
    if (files.length > 10) {
      toast.error("Du kan maksimalt vælge 10 billeder ad gangen");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
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

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Vælg venligst billeder at uploade");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("");

    try {
      // Step 1: Compress large files (over 10MB to stay within Cloudinary free tier)
      const MAX_SIZE_MB = 10;
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileSizeMB = file.size / 1024 / 1024;
          
          if (fileSizeMB > MAX_SIZE_MB) {
            try {
              const compressed = await imageCompression(file, {
                maxSizeMB: MAX_SIZE_MB,
                maxWidthOrHeight: 4096,
                useWebWorker: true,
              });
              console.log(`Compressed ${file.name} from ${fileSizeMB.toFixed(2)}MB to ${(compressed.size / 1024 / 1024).toFixed(2)}MB`);
              return compressed;
            } catch (error) {
              console.error(`Failed to compress ${file.name}, using original:`, error);
              return file;
            }
          }
          
          return file;
        })
      );

      // Step 2: Get upload signatures from edge function
      console.log('Getting signatures for', processedFiles.length, 'files');
      const { data: sigData, error: sigError } = await supabase.functions.invoke('upload', {
        body: { fileCount: processedFiles.length }
      });

      if (sigError || !sigData?.signatures) {
        console.error('Failed to get signatures:', sigError);
        throw new Error('Failed to get upload signatures');
      }

      console.log('Got signatures, starting uploads');

      // Step 3: Upload each file directly to Cloudinary in parallel
      const uploadPromises = processedFiles.map(async (file, index) => {
        try {
          const sig = sigData.signatures[index];
          
          const formData = new FormData();
          formData.append('file', file);
          formData.append('api_key', sig.apiKey);
          formData.append('timestamp', sig.timestamp.toString());
          formData.append('folder', sig.folder);
          formData.append('tags', sig.tags);
          formData.append('signature', sig.signature);

          const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;
          
          console.log(`Starting upload for ${file.name}`);
          
          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Upload failed for ${file.name}:`, errorText);
            return { success: false, name: file.name, error: errorText };
          }

          console.log(`Successfully uploaded ${file.name}`);
          return { success: true, name: file.name, data: await response.json() };
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          return { success: false, name: file.name, error: String(error) };
        }
      });

      // Wait for all uploads with progress tracking
      let completed = 0;
      const results = await Promise.all(
        uploadPromises.map(async (promise) => {
          const result = await promise;
          completed++;
          setUploadProgress(Math.round((completed / processedFiles.length) * 100));
          return result;
        })
      );

      console.log('All uploads completed:', results);

      // Count successes
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount === 0) {
        throw new Error('Alle uploads fejlede');
      }

      if (failCount > 0) {
        setUploadStatus(`⚠️ ${successCount} billede(r) uploadet, ${failCount} fejlede.`);
        toast.warning(`${successCount} af ${selectedFiles.length} billeder uploadet`);
      } else {
        setUploadStatus("✅ Tak! Dine billeder er modtaget.");
        setIsSuccess(true);
        toast.success(`${successCount} billede${successCount > 1 ? 'r' : ''} uploadet!`);
      }
      
      setUploadProgress(100);
      
      // Clear selection after short delay
      setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus("❌ Der opstod en fejl. Prøv venligst igen.");
      setUploadProgress(0);
      toast.error("Upload fejlede. Prøv igen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] lg:min-h-screen bg-gradient-to-b from-background to-secondary/30 flex justify-center items-center px-3 sm:px-4 py-4 sm:py-8">
      <Card className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl p-4 sm:p-6 lg:p-8 shadow-[var(--shadow-card)] border-border/50 animate-fade-in rounded-2xl sm:rounded-3xl">
        <div className="text-center space-y-4 sm:space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <img 
              src={mbLogo} 
              alt="MB logo" 
              className="h-20 sm:h-24 md:h-32 w-auto object-contain drop-shadow-md"
            />
          </div>

          {/* Title */}
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              Frivilligfesten 2026
            </h1>
          </div>

          {/* File input */}
          <div className="space-y-4 sm:space-y-6 text-left">
            <label 
              htmlFor="file-upload" 
              className="block cursor-pointer group touch-manipulation"
            >
              <div className="border-2 border-dashed border-border group-hover:border-primary rounded-xl p-6 sm:p-8 transition-all duration-300 bg-secondary/20 group-hover:bg-secondary/40 group-active:scale-[0.97] min-h-[160px] sm:min-h-[180px] flex flex-col items-center justify-center">
                <Camera className="w-12 h-12 sm:w-14 sm:h-14 text-muted-foreground group-hover:text-primary mx-auto mb-3 sm:mb-4 transition-colors" />
                <p className="text-sm sm:text-base text-foreground font-semibold text-center">
                  Vælg billeder fra din telefon
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

            {/* Selected files with previews */}
            {selectedFiles.length > 0 && (
              <div className="bg-secondary/50 rounded-xl p-4 sm:p-6 text-left animate-fade-in">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    Valgte billeder ({selectedFiles.length})
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFiles([])}
                    className="text-xs sm:text-sm h-8 sm:h-9"
                  >
                    Ryd alle
                  </Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 max-h-[400px] overflow-y-auto overscroll-contain">
                  {selectedFiles.map((file, index) => (
                    <div 
                      key={index} 
                      className="relative group rounded-lg overflow-hidden bg-muted aspect-square touch-manipulation"
                    >
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="absolute top-1 right-1 w-8 h-8 sm:w-7 sm:h-7 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                        type="button"
                        aria-label="Fjern billede"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 sm:p-2">
                        <p className="text-[10px] sm:text-xs text-white truncate font-medium">
                          {file.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0}
              size="lg"
              className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-[var(--shadow-button)] transition-all disabled:opacity-50 touch-manipulation active:scale-[0.97]"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {uploading && (
              <div className="space-y-2 animate-fade-in">
                <div className="w-full bg-secondary/50 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground font-medium">
                  {uploadProgress}% færdig
                </p>
              </div>
            )}

            {/* Status message */}
            {uploadStatus && (
              <div className={`p-4 sm:p-5 rounded-xl flex items-start sm:items-center gap-3 sm:gap-4 animate-fade-in ${
                isSuccess 
                  ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-2 border-green-200 dark:border-green-800' 
                  : uploadStatus.includes('❌')
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-2 border-red-200 dark:border-red-800'
                  : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800'
              }`}>
                {isSuccess ? (
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 sm:mt-0" />
                ) : uploadStatus.includes('❌') ? (
                  <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5 sm:mt-0" />
                )}
                <p className="text-sm sm:text-base font-medium leading-relaxed">{uploadStatus}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UploadPage;