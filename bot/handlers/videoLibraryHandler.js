import { getUserGeneratedVideos } from '../../db/database.js';
import { uploadToYouTube } from '../../services/youtubeService.js';
import { getYouTubeChannel } from '../../db/database.js';
import { createYouTubeUpload, updateYouTubeUpload } from '../../db/database.js';
import { getMainKeyboard } from '../messages.js';

/**
 * Handle video library display
 */
export async function handleVideoLibrary(bot, chatId, userId, supabase, messageId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Showing video library for user ${userId}`);
  
  try {
    const videos = await getUserGeneratedVideos(supabase, userId, 20);
    
    if (!videos || videos.length === 0) {
      const message = '📚 Video Library\n\n❌ There are no videos in the library yet.\n\nStart generating a new video!';
      const { getMainKeyboard } = await import('../messages.js');
      if (messageId) {
        await bot.editMessageText(message, { 
          chat_id: chatId, 
          message_id: messageId,
          reply_markup: getMainKeyboard().reply_markup
        });
      } else {
        await bot.sendMessage(chatId, message, getMainKeyboard());
      }
      return;
    }
    
    // Create Reply Keyboard with video list
    const keyboard = {
      keyboard: []
    };
    
    // Add videos (most recent first) - max 10 for Reply Keyboard
    const videosToShow = videos.slice(0, 10);
    videosToShow.forEach((video, index) => {
      const date = new Date(video.created_at).toLocaleDateString('ar-SA');
      const prompt = video.prompt ? video.prompt.substring(0, 25) + '...' : 'No description';
      const buttonText = `🎬 ${index + 1}. ${prompt}`;
      
      keyboard.keyboard.push([
        { text: buttonText }
      ]);
    });
    
    // Add back button
    keyboard.keyboard.push([
      { text: '🔙 Main Menu' }
    ]);
    
    keyboard.resize_keyboard = true;
    keyboard.one_time_keyboard = false;
    
    const message = `📚 Video Library\n\nSelect the video you want to publish on YouTube:\n\nTotal videos: ${videos.length}`;
    
    if (messageId) {
      await bot.editMessageText(message, { 
        chat_id: chatId, 
        message_id: messageId,
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, message, { reply_markup: keyboard });
    }
  } catch (error) {
    console.error(`[${timestamp}] Error showing video library:`, error);
    await bot.sendMessage(chatId, '❌ An error occurred while loading the library. Please try again.');
  }
}

/**
 * Handle viewing a specific video from library (by button text)
 */
export async function handleViewVideoFromButton(bot, chatId, userId, buttonText, supabase) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Viewing video from button: ${buttonText}`);
  
  try {
    // Extract video index from button text (format: "🎬 1. prompt...")
    const match = buttonText.match(/🎬\s*(\d+)\./);
    if (!match) {
      await bot.sendMessage(chatId, '❌ Error selecting the video. Please try again.');
      return;
    }
    
    const videoIndex = parseInt(match[1]) - 1; // Convert to 0-based index
    
    const videos = await getUserGeneratedVideos(supabase, userId, 20);
    if (videoIndex < 0 || videoIndex >= videos.length) {
      await bot.sendMessage(chatId, '❌ The selected video does not exist.');
      return;
    }
    
    const video = videos[videoIndex];
    
    // Check if YouTube is configured
    const youtubeChannel = await getYouTubeChannel(supabase, userId);
    const hasYouTube = youtubeChannel !== null;
    
    // Create Reply Keyboard with actions
    const keyboard = {
      keyboard: [
        [
          { text: '📺 Upload to YouTube' }
        ],
        [
          { text: '🔙 Main Menu' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    };
    
    // Store selected video task_id in user state for upload
    const { getUserState, updateUserState } = await import('../../db/database.js');
    const userState = await getUserState(supabase, userId);
    if (userState) {
      userState.selectedVideoTaskId = video.task_id;
      userState.userId = userId.toString();
      await updateUserState(supabase, userState, userId);
    }
    
    const prompt = video.prompt || 'No description';
    const date = new Date(video.created_at).toLocaleDateString('ar-SA');
    const message = `🎬 Selected Video\n\n📝 Description: ${prompt}\n📅 Date: ${date}\n\n${hasYouTube ? 'You can publish this video on YouTube now!' : '⚠️ You must set up a YouTube channel first.'}`;
    
    // Send video first
    await bot.sendVideo(chatId, video.video_url);
    
    // Then send message with keyboard
    await bot.sendMessage(chatId, message, { reply_markup: keyboard });
  } catch (error) {
    console.error(`[${timestamp}] Error viewing video:`, error);
    await bot.sendMessage(chatId, '❌ An error occurred while displaying the video. Please try again.');
  }
}

/**
 * Handle YouTube upload from library
 */
export async function handleYouTubeUploadFromLibrary(bot, chatId, userId, taskId, supabase) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Uploading video ${taskId} to YouTube from library`);
  
  try {
    // Check if YouTube channel is configured
    const youtubeChannel = await getYouTubeChannel(supabase, userId);
    
    if (!youtubeChannel) {
      await bot.sendMessage(chatId, '⚠️ YouTube channel has not been set up yet.\n\nPlease set up the channel first using the "⚙️ YouTube Channel Setup" button', getMainKeyboard());
      return;
    }
    
    // Get video from library
    const { getGeneratedVideoByTaskId } = await import('../../db/database.js');
    const video = await getGeneratedVideoByTaskId(supabase, taskId);
    
    if (!video) {
      await bot.sendMessage(chatId, '❌ Video not found in the library.');
      return;
    }
    
    const videoUrl = video.video_url;
    const prompt = video.prompt || 'AI Generated Video';
    
    // Create upload record
    const uploadRecord = await createYouTubeUpload(supabase, userId, taskId, videoUrl);
    
    // Send uploading message
    const uploadingMsg = await bot.sendMessage(chatId, '📤 Uploading video to YouTube...');
    
    try {
      // Upload to YouTube
      const uploadResult = await uploadToYouTube(
        videoUrl,
        `${prompt} - ${new Date().toLocaleDateString('ar-SA')}`,
        `This video was generated using artificial intelligence\n\nDescription: ${prompt}`,
        youtubeChannel.client_id,
        youtubeChannel.client_secret,
        youtubeChannel.refresh_token
      );
      
      // Update upload record
      await updateYouTubeUpload(
        supabase,
        uploadRecord.id,
        'success',
        uploadResult.videoId,
        uploadResult.shortsUrl
      );
      
      // Delete uploading message
      await bot.deleteMessage(chatId, uploadingMsg.message_id);
      
      // Send success message with link
      await bot.sendMessage(
        chatId,
        `✅ The video has been published on YouTube successfully!\n\n📺 Video link:\n${uploadResult.shortsUrl}\n\n🎉 You can now watch it on your channel!`,
        getMainKeyboard()
      );
    } catch (uploadError) {
      // Update upload record with error
      await updateYouTubeUpload(
        supabase,
        uploadRecord.id,
        'failed',
        null,
        null,
        uploadError.message
      );
      
      // Delete uploading message
      await bot.deleteMessage(chatId, uploadingMsg.message_id).catch(() => {});
      
      // Send error message
      await bot.sendMessage(
        chatId,
        `❌ Failed to upload the video to YouTube.\n\nDetails:\n${uploadError.message}\n\nPlease check your channel settings and try again.`,
        getMainKeyboard()
      );
    }
  } catch (error) {
    console.error(`[${timestamp}] Error uploading video from library:`, error);
    await bot.sendMessage(chatId, '❌ An error occurred while processing the request. Please try again.');
  }
}
