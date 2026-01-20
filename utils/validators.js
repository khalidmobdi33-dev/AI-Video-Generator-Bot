import axios from 'axios';
import { logger } from './logger.js';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_VIDEO_DURATION = 3; // seconds
const MAX_VIDEO_DURATION = 30; // seconds

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate video file
 */
export async function validateVideo(url, fileSize) {
  logger.video(`Validating video | Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

  // Check file size
  if (fileSize > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `Video size is too large. The maximum allowed size is ${MAX_VIDEO_SIZE / (1024 * 1024)} MB.\nCurrent size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`
    };
  }

  if (fileSize === 0) {
    return {
      valid: false,
      error: 'The file is empty. Please send a valid video.'
    };
  }

  // First, check by file extension in URL (more reliable for Telegram files)
  const urlLower = url.toLowerCase();
  const hasVideoExtension = urlLower.includes('.mp4') || 
                           urlLower.includes('.mov') || 
                           urlLower.includes('.mkv') ||
                           urlLower.includes('video');
  
  if (hasVideoExtension) {
    logger.success('VIDEO', 'Video extension detected, format valid');
    return { valid: true };
  }

  try {
    // Check content type by making HEAD request
    const response = await axios.head(url, {
      timeout: 10000,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'];
    logger.debug('VIDEO', `Content type: ${contentType}`);

    // Check if content type is supported
    if (contentType && ALLOWED_VIDEO_TYPES.some(type => contentType.includes(type))) {
      return { valid: true };
    }

    // If content type is application/octet-stream but we have a video extension, accept it
    // Telegram often returns application/octet-stream for video files
    if (contentType === 'application/octet-stream' || !contentType) {
      logger.warning('VIDEO', `Content type is ${contentType || 'unknown'}, accepting as video file`);
      return { valid: true };
    }

    // Only reject if we have a specific non-video content type
    if (contentType && !contentType.includes('video') && !contentType.includes('application/octet-stream')) {
      return {
        valid: false,
        error: `Unsupported video type. Supported formats: MP4, MOV, MKV.\nCurrent type: ${contentType}`
      };
    }

    // Default: accept the file (API will validate it anyway)
    return { valid: true };
  } catch (error) {
    logger.error('VIDEO', `Validation error: ${error.message}`);
    
    // If HEAD request fails, accept the file if it has a video extension
    // The API will validate it anyway
    if (hasVideoExtension) {
      logger.warning('VIDEO', 'HEAD request failed, but URL looks valid - accepting');
      return { valid: true };
    }

    // If no extension and HEAD fails, still accept (let API handle validation)
    logger.warning('VIDEO', 'Could not validate, but will accept and let API validate');
    return { valid: true };
  }
}

/**
 * Validate image file
 */
export async function validateImage(url, fileSize) {
  logger.image(`Validating image | Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

  // Check file size
  if (fileSize > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image size is too large. The maximum allowed size is ${MAX_IMAGE_SIZE / (1024 * 1024)} MB.\nCurrent size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`
    };
  }

  if (fileSize === 0) {
    return {
      valid: false,
      error: 'The file is empty. Please send a valid image.'
    };
  }

  // First, check by file extension in URL (more reliable for Telegram files)
  const urlLower = url.toLowerCase();
  const hasImageExtension = urlLower.includes('.jpg') || 
                           urlLower.includes('.jpeg') || 
                           urlLower.includes('.png') ||
                           urlLower.includes('.webp') ||
                           urlLower.includes('photo') ||
                           urlLower.includes('image');
  
  if (hasImageExtension) {
    logger.success('IMAGE', 'Image extension detected, format valid');
    return { valid: true };
  }

  try {
    // Check content type by making HEAD request
    const response = await axios.head(url, {
      timeout: 10000,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'];
    logger.debug('IMAGE', `Content type: ${contentType}`);

    // Check if content type is supported
    if (contentType && ALLOWED_IMAGE_TYPES.some(type => contentType.includes(type))) {
      return { valid: true };
    }

    // If content type is application/octet-stream but we have an image extension, accept it
    // Telegram often returns application/octet-stream for image files
    if (contentType === 'application/octet-stream' || !contentType) {
      logger.warning('IMAGE', `Content type is ${contentType || 'unknown'}, accepting as image file`);
      return { valid: true };
    }

    // Only reject if we have a specific non-image content type
    if (contentType && !contentType.includes('image') && !contentType.includes('application/octet-stream')) {
      return {
        valid: false,
        error: `Unsupported image type. Supported formats: JPEG, PNG, WEBP.\nCurrent type: ${contentType}`
      };
    }

    // Default: accept the file (API will validate it anyway)
    return { valid: true };
  } catch (error) {
    logger.error('IMAGE', `Validation error: ${error.message}`);
    
    // If HEAD request fails, accept the file if it has an image extension
    // The API will validate it anyway
    if (hasImageExtension) {
      logger.warning('IMAGE', 'HEAD request failed, but URL looks valid - accepting');
      return { valid: true };
    }

    // If no extension and HEAD fails, still accept (let API handle validation)
    logger.warning('IMAGE', 'Could not validate, but will accept and let API validate');
    return { valid: true };
  }
}
