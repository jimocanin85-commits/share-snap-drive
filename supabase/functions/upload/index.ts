import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import type { Algorithm } from "https://deno.land/x/djwt@v3.0.2/algorithm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create JWT for Google API authentication
async function createJWT(clientEmail: string, privateKey: string): Promise<string> {
  const header = { alg: "RS256" as Algorithm, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Import private key - handle both escaped and actual newlines
  let keyData = privateKey;
  
  // Replace escaped newlines with actual newlines
  if (keyData.includes('\\n')) {
    keyData = keyData.replace(/\\n/g, '\n');
  }
  
  // Remove headers, footers, and all whitespace to get pure base64
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  // Extract just the base64 content
  let base64Key = keyData
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/[\s\n\r]/g, '');  // Remove all whitespace
  
  // Validate base64 - only keep valid base64 characters (A-Z, a-z, 0-9, +, /, =)
  base64Key = base64Key.replace(/[^A-Za-z0-9+/=]/g, '');
  
  console.log('Base64 key length after cleaning:', base64Key.length);
  console.log('First 50 chars:', base64Key.substring(0, 50));
  
  try {
    const binaryKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    return await create(header, payload, cryptoKey);
  } catch (error) {
    console.error('Failed to process private key:', error);
    console.error('Key might contain invalid characters or be improperly formatted');
    throw new Error('Invalid private key format. Please ensure the key is properly copied from your Google Service Account JSON file.');
  }
}

// Helper function to get access token
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await createJWT(clientEmail, privateKey);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

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

    // Get access token
    const accessToken = await getAccessToken(clientEmail, privateKey);

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
        const fileBuffer = await file.arrayBuffer();
        
        // Create metadata for the file
        const metadata = {
          name: fileName,
          parents: [folderId],
        };

        // Create multipart upload with proper binary handling
        const boundary = '-------314159265358979323846';
        const metadataPart = new TextEncoder().encode(
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) + '\r\n'
        );
        
        const filePart = new TextEncoder().encode(
          `--${boundary}\r\n` +
          `Content-Type: ${file.type}\r\n\r\n`
        );
        
        const fileData = new Uint8Array(fileBuffer);
        const endBoundary = new TextEncoder().encode(`\r\n--${boundary}--`);
        
        // Combine all parts
        const multipartBody = new Uint8Array(
          metadataPart.length + filePart.length + fileData.length + endBoundary.length
        );
        multipartBody.set(metadataPart, 0);
        multipartBody.set(filePart, metadataPart.length);
        multipartBody.set(fileData, metadataPart.length + filePart.length);
        multipartBody.set(endBoundary, metadataPart.length + filePart.length + fileData.length);

        // Upload to Google Drive using REST API
        const uploadResponse = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
              'Content-Length': multipartBody.length.toString(),
            },
            body: multipartBody,
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error(`Upload failed for ${file.name}:`, errorText);
          throw new Error(`Upload failed: ${errorText}`);
        }

        const responseData = await uploadResponse.json();

        results.push({
          name: file.name,
          success: true,
          fileId: responseData.id,
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