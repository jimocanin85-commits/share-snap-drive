import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Get Cloudinary credentials from environment variables
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    console.log('Cloudinary Config - Cloud Name:', cloudName);
    console.log('Cloudinary Config - API Key exists:', !!apiKey);
    console.log('Cloudinary Config - API Secret exists:', !!apiSecret);

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary credentials');
    }

    console.log('Processing upload request with updated credentials...');

    // Parse form data
    const formData = await req.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Received ${files.length} files`);

    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    const ALLOWED_TYPES = [
      'image/jpeg', 
      'image/jpg',
      'image/png', 
      'image/webp', 
      'image/heic',
      'image/heif',
      'image/gif',
      'image/bmp',
      'image/tiff'
    ];

    // Process all files in parallel for faster uploads
    const uploadPromises = Array.from(files).map(async (file) => {
      if (!(file instanceof File)) return null;

      const fileName = file.name;
      console.log(`Processing file: ${fileName}`);

      try {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          return {
            name: fileName,
            success: false,
            error: 'Invalid file type. Only images (JPG, PNG, WEBP, HEIC, GIF, etc.) allowed.',
          };
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return {
            name: fileName,
            success: false,
            error: 'File too large. Maximum size is 15MB.',
          };
        }

        // Convert file to base64 (handle large files properly)
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Convert to base64 in chunks to avoid stack overflow
        let binary = '';
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        const dataUri = `data:${file.type};base64,${base64}`;

        // Create upload signature
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = 'JasSari40aars';
        
        // Create signature string (alphabetical order of parameters)
        const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(signatureString);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Prepare upload to Cloudinary
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
        const uploadFormData = new FormData();
        uploadFormData.append('file', dataUri);
        uploadFormData.append('api_key', apiKey);
        uploadFormData.append('timestamp', timestamp.toString());
        uploadFormData.append('folder', folder);
        uploadFormData.append('signature', signature);

        console.log(`Uploading ${fileName} to Cloudinary...`);

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error(`Cloudinary upload failed for ${fileName}:`, errorText);
          throw new Error(`Upload failed: ${errorText}`);
        }

        const result = await uploadResponse.json();
        console.log(`Successfully uploaded ${fileName} to Cloudinary`);

        return {
          name: fileName,
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
        };
      } catch (error) {
        console.error(`Error uploading ${fileName}:`, error);
        return {
          name: fileName,
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      }
    });

    // Wait for all uploads to complete in parallel
    const uploadResults = await Promise.all(uploadPromises);
    const results = uploadResults.filter(r => r !== null);

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
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
