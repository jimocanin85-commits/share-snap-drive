import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Presentation, ExternalLink } from "lucide-react";

const AdminPage = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uploadUrl, setUploadUrl] = useState("");

  useEffect(() => {
    // Get the current domain and construct the upload URL
    const url = window.location.origin + "/";
    setUploadUrl(url);

    // Generate QR code
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        url,
        {
          width: 400,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (error) => {
          if (error) console.error("Error generating QR code:", error);
        }
      );
    }
  }, []);

  const downloadQRCode = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "upload-qr-code.png";
      link.href = url;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Upload Page QR Code</h1>
          <p className="text-muted-foreground">
            Scan this code to access the image upload page
          </p>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <canvas ref={canvasRef} />
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm font-medium">Upload URL:</p>
            <code className="block bg-muted px-4 py-2 rounded text-sm break-all">
              {uploadUrl}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <Button onClick={downloadQRCode} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download QR Code
            </Button>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-md">
            <Button 
              onClick={() => navigate("/slideshow")} 
              variant="secondary"
            >
              <Presentation className="mr-2 h-4 w-4" />
              Se slideshow
            </Button>
            <Button 
              onClick={() => navigate("/gallery")} 
              variant="secondary"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Se billeder i Web browser
            </Button>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>Print this QR code and place it where you want people to scan.</p>
          <p>They'll be taken directly to the upload page.</p>
        </div>
      </Card>
    </div>
  );
};

export default AdminPage;
