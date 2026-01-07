import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(`[${new Date().toISOString()}] ERROR: Supabase credentials are not set for storage`);
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Upload video file to Supabase Storage
 */
export async function uploadVideoToStorage(filePath, fileName) {
  const timestamp = new Date().toISOString();
  
  if (!supabase) {
    throw new Error('Supabase storage is not configured');
  }

  console.log(`[${timestamp}] Uploading video to Supabase Storage: ${fileName}`);

  try {
    // Read file
    const fileBuffer = await fs.readFile(filePath);
    
    // Generate unique file name
    const uniqueFileName = `videos/${Date.now()}_${Math.random().toString(36).substring(7)}_${path.basename(fileName)}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('videos') // Make sure this bucket exists in Supabase
      .upload(uniqueFileName, fileBuffer, {
        contentType: 'video/mp4',
        upsert: false
      });

    if (error) {
      console.error(`[${timestamp}] Error uploading to Supabase Storage:`, error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(uniqueFileName);

    const publicUrl = urlData.publicUrl;
    console.log(`[${timestamp}] Video uploaded successfully: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error(`[${timestamp}] Error in uploadVideoToStorage:`, error);
    throw error;
  }
}

/**
 * Delete video from Supabase Storage
 */
export async function deleteVideoFromStorage(fileName) {
  const timestamp = new Date().toISOString();
  
  if (!supabase) {
    return;
  }

  try {
    const { error } = await supabase.storage
      .from('videos')
      .remove([fileName]);

    if (error) {
      console.error(`[${timestamp}] Error deleting from Supabase Storage:`, error);
    } else {
      console.log(`[${timestamp}] Video deleted from storage: ${fileName}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] Error in deleteVideoFromStorage:`, error);
  }
}

