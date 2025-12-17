import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const PUBLIC_UPLOAD_URL = import.meta.env.VITE_PUBLIC_UPLOAD_URL as string | undefined;

const AdminPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uploadUrl, setUploadUrl] = useState("");

  useEffect(() => {
    // Get the public upload URL (env override) or fall back to current origin
    const url = PUBLIC_UPLOAD_URL || window.location.origin + "/";
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex justify-center items-start py-4 sm:py-8 px-3 sm:px-4">
      <Card className="w-full max-w-md sm:max-w-xl p-4 sm:p-6 lg:p-8 shadow-[var(--shadow-card)] border-border/50 rounded-2xl sm:rounded-3xl space-y-5 sm:space-y-6">
        <div className="text-center space-y-1 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">Frivilligfesten 2026 – QR-kode</h1>
          <p className="text-xs sm:text-sm text-muted-foreground px-2">
            Scan koden med din telefon for at åbne uploadsiden.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-5 sm:space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-lg max-w-xs w-full flex justify-center">
            <canvas ref={canvasRef} className="w-full h-auto max-w-[260px] sm:max-w-[320px]" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-xs sm:text-sm font-medium">Upload-URL</p>
            <code className="block bg-muted px-3 py-2 rounded text-[11px] sm:text-xs break-all">
              {uploadUrl}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button onClick={downloadQRCode} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download QR-kode
            </Button>
          </div>
        </div>

        <div className="text-center text-[11px] sm:text-xs text-muted-foreground space-y-1">
          <p>Print QR-koden og hæng den op, hvor gæsterne nemt kan se den.</p>
          <p>Når de scanner, kommer de direkte til siden hvor de kan uploade billeder.</p>
        </div>
      </Card>
    </div>
  );
};

export default AdminPage;
