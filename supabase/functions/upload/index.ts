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

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary credentials');
    }

    // Parse request body to get file count with better error handling
    let body;
    try {
      const text = await req.text();
      console.log('Received request body:', text);
      body = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      body = {};
    }
    
    const fileCount = body.fileCount || 1;

    console.log(`Generating signatures for ${fileCount} files`);

    // Generate signature for each file
    const signatures = [];
    for (let i = 0; i < fileCount; i++) {
      const timestamp = Math.floor(Date.now() / 1000) + i; // Unique timestamp for each
      const folder = 'JasSari40aars';
      
      // Create signature string
      const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureString);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      signatures.push({
        timestamp,
        signature,
        folder,
        cloudName,
        apiKey,
      });
    }

    return new Response(
      JSON.stringify({ signatures }),
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
