import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs-extra';
import { logger } from '../utils/logger.js';

/**
 * YouTube Service for uploading videos using OAuth 2.0
 */

/**
 * Get OAuth2 client with refresh token
 */
function getOAuth2Client(clientId, clientSecret, refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return oauth2Client;
}

/**
 * Upload video to YouTube as Shorts
 */
export async function uploadToYouTube(videoUrl, title, description, clientId, clientSecret, refreshToken) {
  logger.api('Starting YouTube upload process');
  
  try {
    // Download video from URL
    logger.processing('Downloading video for YouTube upload');
    const videoPath = await downloadVideo(videoUrl);
    
    try {
      // Get OAuth2 client
      const oauth2Client = getOAuth2Client(clientId, clientSecret, refreshToken);
      
      // Initialize YouTube API
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });
      
      // Upload video
      logger.api('Uploading video to YouTube as Shorts');
      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title || 'AI Generated Video',
            description: description || 'Generated using AI',
            categoryId: '22', // People & Blogs
            tags: ['AI', 'Shorts', 'Generated']
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(videoPath)
        }
      });
      
      const videoId = response.data.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
      
      logger.success('API', `Video uploaded successfully: ${shortsUrl}`);
      
      // Clean up downloaded file
      await fs.remove(videoPath);
      
      return {
        success: true,
        videoId: videoId,
        url: youtubeUrl,
        shortsUrl: shortsUrl
      };
    } catch (uploadError) {
      // Clean up on error
      await fs.remove(videoPath).catch(() => {});
      throw uploadError;
    }
  } catch (error) {
    logger.error('API', `YouTube upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Download video from URL to temporary file
 */
async function downloadVideo(url) {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { createWriteStream } = await import('fs');
  const { pipeline } = await import('stream/promises');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  
  const fileName = `youtube_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
  const filePath = path.join(tempDir, fileName);
  
  logger.processing(`Downloading video to ${filePath}`);
  
  const response = await axios({
    url: url,
    method: 'GET',
    responseType: 'stream',
    timeout: 300000 // 5 minutes
  });
  
  const writer = createWriteStream(filePath);
  await pipeline(response.data, writer);
  
  logger.success('PROCESSING', 'Video downloaded successfully');
  return filePath;
}

/**
 * Verify YouTube OAuth credentials
 */
export async function verifyYouTubeCredentials(clientId, clientSecret, refreshToken) {
  logger.api('Verifying YouTube OAuth credentials');
  
  try {
    const oauth2Client = getOAuth2Client(clientId, clientSecret, refreshToken);
    
    // Initialize YouTube API
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Get channel information
    const response = await youtube.channels.list({
      part: ['snippet', 'contentDetails'],
      mine: true
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      logger.success('API', `Channel verified: ${channel.snippet.title}`);
      return {
        valid: true,
        channelTitle: channel.snippet.title,
        channelId: channel.id
      };
    } else {
      logger.error('API', 'Channel not found');
      return {
        valid: false,
        error: 'Channel not found'
      };
    }
  } catch (error) {
    logger.error('API', `Credential verification failed: ${error.message}`);
    return {
      valid: false,
      error: error.message
    };
  }
}
