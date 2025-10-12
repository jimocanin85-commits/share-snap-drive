import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { google } from "googleapis";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');
    const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

    if (!clientEmail || !privateKey || !folderId) {
      throw new Error('Missing required environment variables');
    }

    // Parse form data
    const formData = await req.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Setup Google Drive authentication
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const results = [];
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

    // Process each file
    for (const file of files) {
      if (!(file instanceof File)) continue;

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        results.push({
          name: file.name,
          success: false,
          error: 'Invalid file type. Only JPG, PNG, and WEBP allowed.',
        });
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          name: file.name,
          success: false,
          error: 'File too large. Maximum size is 15MB.',
        });
        continue;
      }

      try {
        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomId = crypto.randomUUID().slice(0, 8);
        const fileName = `${timestamp}_${randomId}_${file.name}`;

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Upload to Google Drive
        const response = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [folderId],
          },
          media: {
            mimeType: file.type,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(buffer);
                controller.close();
              },
            }),
          },
        });

        results.push({
          name: file.name,
          success: true,
          fileId: response.data.id,
        });
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        results.push({
          name: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    // Check if any uploads succeeded
    const successCount = results.filter(r => r.success).length;
    
    if (successCount === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'All uploads failed', 
          results 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: `${successCount} file(s) uploaded successfully`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});