import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Temporary directory for video processing
const TEMP_DIR = path.join(__dirname, '../../temp');

// Initialize temp directory
fs.ensureDirSync(TEMP_DIR);

// Supported video formats by kie.ai
const SUPPORTED_FORMATS = ['mp4', 'mov', 'mkv'];
const TARGET_FORMAT = 'mp4';

/**
 * Check if video format is supported
 */
export function isFormatSupported(filePath, mimeType) {
  const timestamp = new Date().toISOString();
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  
  // Check by extension first (most reliable)
  if (SUPPORTED_FORMATS.includes(ext)) {
    console.log(`[${timestamp}] Format check - Extension: ${ext}, Supported: true`);
    return true;
  }
  
  // Check by MIME type
  if (mimeType) {
    const isSupportedByMime = mimeType.includes('mp4') || 
                              mimeType.includes('quicktime') || 
                              mimeType.includes('x-matroska') ||
                              mimeType.includes('video/');
    
    if (isSupportedByMime) {
      console.log(`[${timestamp}] Format check - MIME: ${mimeType}, Supported: true`);
      return true;
    }
  }
  
  // If MIME type is application/octet-stream, check by extension
  // Telegram often returns this for video files
  if (mimeType === 'application/octet-stream' || !mimeType) {
    // If file path contains video-related keywords, assume it's a video
    const filePathLower = filePath.toLowerCase();
    if (filePathLower.includes('video') || filePathLower.includes('.mp4') || 
        filePathLower.includes('.mov') || filePathLower.includes('.mkv')) {
      console.log(`[${timestamp}] Format check - Extension/MIME ambiguous, but file appears to be video, Supported: true`);
      return true;
    }
  }
  
  console.log(`[${timestamp}] Format check - Extension: ${ext}, MIME: ${mimeType}, Supported: false`);
  return false;
}

/**
 * Download video from URL to temporary file
 */
async function downloadVideo(url, outputPath) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Downloading video from ${url} to ${outputPath}`);
  
  try {
    const response = await axios({
      url: url,
      method: 'GET',
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      maxRedirects: 5
    });

    const writer = createWriteStream(outputPath);
    await pipeline(response.data, writer);
    
    console.log(`[${timestamp}] Video downloaded successfully`);
  } catch (error) {
    console.error(`[${timestamp}] Error downloading video:`, error);
    throw new Error(`فشل تحميل الفيديو: ${error.message}`);
  }
}

/**
 * Convert video to MP4 format
 */
async function convertVideo(inputPath, outputPath) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Converting video from ${inputPath} to ${outputPath}`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',      // Video codec
        '-c:a aac',          // Audio codec
        '-preset fast',      // Encoding speed
        '-crf 23',           // Quality (lower = better quality)
        '-movflags +faststart', // Web optimization
        '-pix_fmt yuv420p'   // Compatibility
      ])
      .on('start', (commandLine) => {
        console.log(`[${timestamp}] FFmpeg command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[${timestamp}] Conversion progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(`[${timestamp}] Video conversion completed`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`[${timestamp}] FFmpeg error:`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Upload video to a temporary hosting service or return local path
 * For now, we'll return the local path and the caller should handle upload
 */
async function uploadVideo(filePath) {
  // In production, you might want to upload to a CDN or storage service
  // For now, we'll return the file path
  // The caller should handle making it accessible via URL
  return filePath;
}

/**
 * Convert video if format is not supported
 * Returns the converted video URL or original URL if conversion not needed
 */
export async function convertVideoIfNeeded(videoUrl, mimeType, fileName) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Checking if video conversion is needed: ${videoUrl}`);
  
  // Check if format is already supported
  if (isFormatSupported(fileName || videoUrl, mimeType)) {
    console.log(`[${timestamp}] Video format is already supported, no conversion needed`);
    return { converted: false, url: videoUrl };
  }

  console.log(`[${timestamp}] Video format not supported, starting conversion...`);
  
  try {
    // Generate unique file names
    const inputFileName = `input_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const outputFileName = `output_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
    const inputPath = path.join(TEMP_DIR, inputFileName);
    const outputPath = path.join(TEMP_DIR, outputFileName);

    // Download video
    await downloadVideo(videoUrl, inputPath);
    
    // Convert video
    await convertVideo(inputPath, outputPath);
    
    // Clean up input file
    await fs.remove(inputPath);
    
    // Return output path (in production, upload to CDN and return URL)
    console.log(`[${timestamp}] Video converted successfully to ${outputPath}`);
    
    // Note: In production, you should upload the converted video to a public URL
    // For now, we'll return the local path - you'll need to handle serving it
    // or upload it to a storage service
    
    return {
      converted: true,
      url: outputPath, // This should be a public URL in production
      localPath: outputPath,
      cleanup: async () => {
        try {
          await fs.remove(outputPath);
          console.log(`[${timestamp}] Cleaned up converted video file`);
        } catch (cleanupError) {
          console.error(`[${timestamp}] Error cleaning up:`, cleanupError);
        }
      }
    };
  } catch (error) {
    console.error(`[${timestamp}] Error converting video:`, error);
    throw new Error(`فشل تحويل الفيديو: ${error.message}`);
  }
}

/**
 * Clean up temporary files older than 1 hour
 */
export async function cleanupTempFiles() {
  const timestamp = new Date().toISOString();
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > oneHour) {
        await fs.remove(filePath);
        console.log(`[${timestamp}] Cleaned up old temp file: ${file}`);
      }
    }
  } catch (error) {
    console.error(`[${timestamp}] Error cleaning up temp files:`, error);
  }
}

// Clean up temp files on startup (async)
setTimeout(() => {
  cleanupTempFiles().catch(err => {
    console.error(`[${new Date().toISOString()}] Error in initial cleanup:`, err);
  });
}, 5000); // Wait 5 seconds after startup

// Clean up temp files every hour
setInterval(() => {
  cleanupTempFiles().catch(err => {
    console.error(`[${new Date().toISOString()}] Error in scheduled cleanup:`, err);
  });
}, 60 * 60 * 1000);

