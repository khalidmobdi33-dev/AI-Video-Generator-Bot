import { getUserState, updateUserState, getYouTubeChannel, getUserGeneratedVideos, getGeneratedVideoByTaskId } from '../../db/database.js';
import { sendYouTubeSetupStep1, sendVideoRequest, getMainKeyboard } from '../messages.js';
import { verifyYouTubeCredentials } from '../../services/youtubeService.js';
import { uploadToYouTube } from '../../services/youtubeService.js';
import { createYouTubeUpload, updateYouTubeUpload } from '../../db/database.js';
import { handleVideoLibrary, handleYouTubeUploadFromLibrary } from './videoLibraryHandler.js';

export async function handleCallbackQuery(bot, query, supabase) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] Handling callback query: ${data} from user ${userId}`);

  // Answer callback query
  await bot.answerCallbackQuery(query.id);

  // Handle different callback actions
  // Check for callbacks with parameters first (format: action:param)
  if (data.startsWith('upload_from_library:')) {
    const taskId = data.split(':')[1];
    await handleYouTubeUploadFromLibrary(bot, chatId, userId, taskId, supabase);
    return;
  }
  
  // Handle simple callbacks
  switch (data) {
    case 'start_generation':
      const userState = await getUserState(supabase, userId);
      if (userState) {
        userState.userId = userId.toString();
        userState.state = 'waiting_video';
        await updateUserState(supabase, userState, userId);
      }
      await sendVideoRequest(bot, chatId, query.message.message_id);
      break;
    
    case 'setup_youtube':
      const setupState = await getUserState(supabase, userId);
      if (setupState) {
        setupState.userId = userId.toString();
        setupState.state = 'youtube_setup_client_secret';
        await updateUserState(supabase, setupState, userId);
      }
      await sendYouTubeSetupStep1(bot, chatId, query.message.message_id);
      break;
    
    // upload_youtube is now handled via text message "📺 Upload to YouTube"
    // Removed from here
    
    case 'video_library':
      await handleVideoLibrary(bot, chatId, userId, supabase, query.message.message_id);
      break;
    
    case 'back_to_main':
      await bot.editMessageText('👋 Main Menu', { 
        chat_id: chatId, 
        message_id: query.message.message_id,
        reply_markup: getMainKeyboard().reply_markup
      });
      break;
    
    case 'cancel':
      const cancelState = await getUserState(supabase, userId);
      if (cancelState) {
        cancelState.userId = userId.toString();
        cancelState.state = 'idle';
        cancelState.videoFileId = null;
        cancelState.imageFileId = null;
        cancelState.videoUrl = null;
        cancelState.imageUrl = null;
        cancelState.prompt = null;
        cancelState.taskId = null;
        await updateUserState(supabase, cancelState, userId);
      }
      await bot.sendMessage(chatId, '✅ The operation has been canceled. Start again using /start', getMainKeyboard());
      break;
    
    default:
      console.log(`[${timestamp}] Unknown callback data: ${data}`);
  }
}

async function handleYouTubeUpload(bot, chatId, userId, supabase) {
  const timestamp = new Date().toISOString();
  
  try {
    // Check if YouTube channel is configured
    const youtubeChannel = await getYouTubeChannel(supabase, userId);
    
    if (!youtubeChannel) {
      // Channel not configured, ask user to set it up
      await bot.sendMessage(chatId, '⚠️ YouTube channel is not set up yet.\n\nPlease set up the channel first using the "⚙️ Set Up YouTube Channel" button', getMainKeyboard());
      return;
    }
    
    // Get user state to find the generated video
    const userState = await getUserState(supabase, userId);
    if (!userState || !userState.taskId) {
      await bot.sendMessage(chatId, '❌ No generated video was found. Please generate a new video first.');
      return;
    }
    
    // Find the task to get video URL
    const { data: tasks } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('task_id', userState.taskId)
      .single();
    
    if (!tasks || tasks.state !== 'success') {
      await bot.sendMessage(chatId, '❌ The video is not completed yet or generation failed.');
      return;
    }
    
    const resultJson = JSON.parse(tasks.result_json || '{}');
    const videoUrl = resultJson.resultUrls?.[0];
    
    if (!videoUrl) {
      await bot.sendMessage(chatId, '❌ Video URL was not found.');
      return;
    }
    
    // Create upload record
    const uploadRecord = await createYouTubeUpload(supabase, userId, taskId, videoUrl);
    
    // Send uploading message
    const uploadingMsg = await bot.sendMessage(chatId, '📤 Uploading the video to YouTube...');
    
    try {
      // Upload to YouTube
      const uploadResult = await uploadToYouTube(
        videoUrl,
        `AI Generated Video - ${new Date().toLocaleDateString('ar-SA')}`,
        'This video was generated using artificial intelligence',
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
        `❌ Failed to upload the video to YouTube.\n\nDetails:\n${uploadError.message}\n\nPlease check the channel settings and try again.`,
        getMainKeyboard()
      );
    }
  } catch (error) {
    console.error(`[${timestamp}] Error handling YouTube upload:`, error);
    await bot.sendMessage(chatId, '❌ An error occurred while processing the request. Please try again.');
  }
}
