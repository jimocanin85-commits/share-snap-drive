import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jasSariPhoto from "@/assets/jas-sari-photo.jpg";

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

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
      // Get Supabase URL and anon key from client
      const supabaseUrl = 'https://yqbnwxwqlekqwdooevyb.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYm53eHdxbGVrcXdkb29ldnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTI1MTksImV4cCI6MjA3NTc2ODUxOX0.WBP2B6EHr1IEpMMEUOpQYonNoNyVF7HNKKrCgr_dQZI';
      const functionUrl = `${supabaseUrl}/functions/v1/upload`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload fejlede' }));
        throw new Error(errorData.error || 'Upload fejlede');
      }

      const data = await response.json();

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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-3 sm:p-6">
      <Card className="w-full max-w-2xl p-5 sm:p-8 lg:p-10 shadow-[var(--shadow-card)] border-border/50 animate-fade-in">
        <div className="text-center space-y-5 sm:space-y-8">
          {/* Photo */}
          <div className="flex justify-center">
            <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full overflow-hidden shadow-[var(--shadow-button)] ring-4 ring-primary/20">
              <img 
                src={jasSariPhoto} 
                alt="Jas & Sari" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              Jas&Sari 40 års
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground px-4">
              Vælg billeder fra din telefon og tryk Upload
            </p>
          </div>

          {/* File input */}
          <div className="space-y-4 sm:space-y-6">
            <label 
              htmlFor="file-upload" 
              className="block cursor-pointer group touch-manipulation"
            >
              <div className="border-2 border-dashed border-border group-hover:border-primary rounded-xl p-10 sm:p-12 transition-all duration-300 bg-secondary/20 group-hover:bg-secondary/40 group-active:scale-[0.97] min-h-[180px] sm:min-h-[200px] flex flex-col items-center justify-center">
                <Upload className="w-14 h-14 sm:w-16 sm:h-16 text-muted-foreground group-hover:text-primary mx-auto mb-3 sm:mb-4 transition-colors" />
                <p className="text-base sm:text-lg text-foreground font-semibold mb-1 sm:mb-2">
                  Tryk her for at vælge billeder
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground px-4">
                  Alle billedformater understøttes (JPG, PNG, HEIC, etc.)
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                capture="environment"
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
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Uploader...
                </span>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                </>
              )}
            </Button>

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