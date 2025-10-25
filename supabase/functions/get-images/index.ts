import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary credentials');
    }

    // Fetch images with the tag "JasSari40aars" from Cloudinary
    const auth = btoa(`${apiKey}:${apiSecret}`);
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/tags/JasSari40aars?max_results=500`;
    
    console.log('Fetching images from Cloudinary with tag: JasSari40aars');
    
    const response = await fetch(cloudinaryUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudinary API error:', errorText);
      throw new Error(`Cloudinary API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Found ${data.resources?.length || 0} images`);

    // Return the image URLs with high quality transformations
    const images = data.resources?.map((resource: any) => ({
      url: resource.secure_url.replace('/upload/', '/upload/q_auto:best,f_auto/'),
      publicId: resource.public_id,
    })) || [];

    return new Response(
      JSON.stringify({ images }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error fetching images:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
