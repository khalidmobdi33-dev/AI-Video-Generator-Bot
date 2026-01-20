import { getUserState, updateUserState, createUserTask, saveYouTubeChannel, getYouTubeChannel, saveGeneratedVideo } from '../../db/database.js';
import { validateVideo, validateImage } from '../../utils/validators.js';
import { sendWelcomeMessage, sendVideoRequest, sendImageRequest, sendPromptRequest, sendYouTubeSetupStep1, sendYouTubeSetupStep2, sendYouTubeSetupStep3, sendYouTubeSetupSuccess, getYouTubeUploadKeyboard, getWelcomeMessage, getMainKeyboard } from '../messages.js';
import { startVideoGeneration } from '../../services/kieService.js';
import { convertVideoIfNeeded } from '../../utils/videoConverter.js';
import { uploadVideoToStorage } from '../../utils/storage.js';
import { verifyYouTubeCredentials } from '../../services/youtubeService.js';

const STATES = {
  IDLE: 'idle',
  WAITING_VIDEO: 'waiting_video',
  WAITING_IMAGE: 'waiting_image',
  WAITING_PROMPT: 'waiting_prompt',
  GENERATING: 'generating',
  YOUTUBE_SETUP_CLIENT_SECRET: 'youtube_setup_client_secret',
  YOUTUBE_SETUP_CLIENT_ID: 'youtube_setup_client_id',
  YOUTUBE_SETUP_REFRESH_TOKEN: 'youtube_setup_refresh_token',
  WAITING_YOUTUBE_DESCRIPTION: 'waiting_youtube_description'
};

export async function handleMessage(bot, msg, supabase) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const timestamp = new Date().toISOString();
  
  // Validate userId
  if (!userId) {
    console.error(`[${timestamp}] CRITICAL: userId is missing from message!`, msg);
    return;
  }
  
  console.log(`[${timestamp}] DEBUG handleMessage - userId: ${userId}, chatId: ${chatId}`);

  // Get or create user state
  let userState = await getUserState(supabase, userId);
  
  if (!userState) {
    console.log(`[${timestamp}] New user ${userId}, initializing state`);
    userState = {
      userId: userId.toString(),
      state: STATES.IDLE,
      videoFileId: null,
      imageFileId: null,
      videoUrl: null,
      imageUrl: null,
      prompt: null,
      taskId: null,
      currentMessageId: null,
      youtubeClientSecret: null,
      youtubeClientId: null
    };
    await updateUserState(supabase, userState, userId);
  } else {
    userState.userId = userId.toString();
    
    if (userState.youtubeClientSecret === undefined) {
      userState.youtubeClientSecret = null;
    }
    if (userState.youtubeClientId === undefined) {
      userState.youtubeClientId = null;
    }
    if (userState.currentMessageId === undefined) {
      userState.currentMessageId = null;
    }
  }
  
  if (!userState.userId) {
    userState.userId = userId.toString();
  }

  // Handle commands
  if (text && text.startsWith('/')) {
    if (text === '/start') {
      await sendWelcomeMessage(bot, chatId);
      userState.userId = userId.toString();
      userState.state = STATES.WAITING_VIDEO;
      await updateUserState(supabase, userState, userId);
      const videoMsg = await sendVideoRequest(bot, chatId);
      if (videoMsg) {
        userState.currentMessageId = videoMsg.message_id;
        await updateUserState(supabase, userState, userId);
      }
      return;
    }
    
    if (text === '/cancel') {
      userState.userId = userId.toString();
      userState.state = STATES.IDLE;
      userState.videoFileId = null;
      userState.imageFileId = null;
      userState.videoUrl = null;
      userState.imageUrl = null;
      userState.prompt = null;
      userState.taskId = null;
      await updateUserState(supabase, userState, userId);
      await bot.sendMessage(chatId, '✅ The operation has been canceled. Start again using /start');
      return;
    }
  }

  switch (userState.state) {
    case STATES.IDLE:
      if (text === '/start') {
        const isFirstTime = !userState.videoFileId && !userState.imageFileId && !userState.prompt;
        
        if (isFirstTime) {
          await bot.sendMessage(chatId, getWelcomeMessage(), getMainKeyboard());
        } else {
          await sendWelcomeMessage(bot, chatId);
        }
      } else if (text === '🎬 Start New Video Generation' || text === 'Start New Video Generation') {
        userState.userId = userId.toString();
        userState.state = STATES.WAITING_VIDEO;
        await updateUserState(supabase, userState, userId);
        const videoMsg = await sendVideoRequest(bot, chatId);
        if (videoMsg) {
          userState.currentMessageId = videoMsg.message_id;
          await updateUserState(supabase, userState, userId);
        }
      } else if (text === '📚 Video Library' || text === 'Video Library') {
        const { handleVideoLibrary } = await import('./videoLibraryHandler.js');
        await handleVideoLibrary(bot, chatId, userId, supabase, null);
      } else if (text === '⚙️ Set Up YouTube Channel' || text === 'Set Up YouTube Channel') {
        const youtubeChannel = await getYouTubeChannel(supabase, userId);
        if (youtubeChannel) {
          const keyboard = {
            keyboard: [
              [
                { text: '🔄 Change Channel Settings' },
                { text: '🗑️ Delete Channel' }
              ],
              [
                { text: '🔙 Main Menu' }
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
          };
          await bot.sendMessage(
            chatId,
            `⚙️ YouTube Channel Settings\n\n✅ Channel configured: ${youtubeChannel.channel_title || 'YouTube Channel'}\n\nChoose the desired action:`,
            { reply_markup: keyboard }
          );
        } else {
          userState.userId = userId.toString();
          userState.state = STATES.YOUTUBE_SETUP_CLIENT_SECRET;
          await updateUserState(supabase, userState, userId);
          await sendYouTubeSetupStep1(bot, chatId);
        }
      } else if (text === '🔄 Change Channel Settings' || text === 'Change Channel Settings') {
        userState.userId = userId.toString();
        userState.state = STATES.YOUTUBE_SETUP_CLIENT_SECRET;
        await updateUserState(supabase, userState, userId);
        await sendYouTubeSetupStep1(bot, chatId);
      } else if (text === '🗑️ Delete Channel' || text === 'Delete Channel') {
        const { deleteYouTubeChannel } = await import('../../db/database.js');
        try {
          await deleteYouTubeChannel(supabase, userId);
          await bot.sendMessage(chatId, '✅ The YouTube channel has been deleted successfully.', getMainKeyboard());
        } catch (error) {
          await bot.sendMessage(chatId, '❌ An error occurred while deleting the channel.', getMainKeyboard());
        }
      } else if (text === '📺 Upload to YouTube' || text === 'Upload to YouTube') {
        userState.userId = userId.toString();
        userState.state = STATES.WAITING_YOUTUBE_DESCRIPTION;
        await updateUserState(supabase, userState, userId);
        await bot.sendMessage(
          chatId,
          '✍️ Please send the video description that will appear on YouTube:\n\nExample: "An amazing video about artificial intelligence"\n\n📝 Write the description now 👇'
        );
      } else if (text === '🔙 Main Menu' || text === 'Main Menu') {
        await bot.sendMessage(chatId, '👋 Main Menu', getMainKeyboard());
      } else {
        await bot.sendMessage(chatId, '👋 Use the buttons below to get started', getMainKeyboard());
      }
      break;

    case STATES.WAITING_VIDEO:
      if (msg.video || msg.document) {
        const fileId = msg.video ? msg.video.file_id : msg.document.file_id;
        const fileName = msg.video ? msg.video.file_name : msg.document.file_name;
        const mimeType = msg.video ? msg.video.mime_type : msg.document.mime_type;

        try {
          const file = await bot.getFile(fileId);
          const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

          const validation = await validateVideo(fileUrl, file.file_size);
          if (!validation.valid) {
            await bot.sendMessage(chatId, `❌ Video error:\n${validation.error}\n\nPlease send a valid video.`);
            return;
          }

          userState.userId = userId.toString();
          userState.videoFileId = fileId;
          userState.videoUrl = fileUrl;
          userState.state = STATES.WAITING_IMAGE;
          await updateUserState(supabase, userState, userId);

          await bot.sendMessage(chatId, '✅ The video has been received successfully!');
          const imageMsg = await sendImageRequest(bot, chatId);
          if (imageMsg) {
            userState.currentMessageId = imageMsg.message_id;
            await updateUserState(supabase, userState, userId);
          }
        } catch (error) {
          await bot.sendMessage(chatId, `❌ An error occurred while processing the video:\n${error.message}\n\nPlease try again.`);
        }
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send a video.');
      }
      break;

    case STATES.WAITING_IMAGE:
      if (msg.photo || msg.document) {
        let fileId, file;
        if (msg.photo) {
          const photo = msg.photo[msg.photo.length - 1];
          fileId = photo.file_id;
          file = await bot.getFile(fileId);
        } else {
          fileId = msg.document.file_id;
          file = await bot.getFile(fileId);
        }

        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

        const validation = await validateImage(fileUrl, file.file_size);
        if (!validation.valid) {
          await bot.sendMessage(chatId, `❌ Image error:\n${validation.error}\n\nPlease send a valid image.`);
          return;
        }

        userState.userId = userId.toString();
        userState.imageFileId = fileId;
        userState.imageUrl = fileUrl;
        userState.state = STATES.WAITING_PROMPT;
        await updateUserState(supabase, userState, userId);

        await bot.sendMessage(chatId, '✅ The image has been received successfully!');
        const promptMsg = await sendPromptRequest(bot, chatId);
        if (promptMsg) {
          userState.currentMessageId = promptMsg.message_id;
          await updateUserState(supabase, userState, userId);
        }
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send an image.');
      }
      break;

    case STATES.WAITING_PROMPT:
      if (text && text.trim().length > 0) {
        if (text.length > 2500) {
          await bot.sendMessage(chatId, '❌ The prompt is too long. The maximum length is 2500 characters.\n\nPlease send a shorter prompt.');
          return;
        }

        userState.userId = userId.toString();
        userState.prompt = text.trim();
        userState.state = STATES.GENERATING;
        await updateUserState(supabase, userState, userId);

        await bot.sendMessage(chatId, '✅ The prompt has been received! Starting video generation...');
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send a text prompt for the video.');
      }
      break;

    case STATES.GENERATING:
      await bot.sendMessage(chatId, '⏳ The video is currently being generated. Please wait...');
      break;

    case STATES.YOUTUBE_SETUP_CLIENT_SECRET:
      if (text && text.trim().length > 0) {
        userState.userId = userId.toString();
        userState.youtubeClientSecret = text.trim();
        userState.state = STATES.YOUTUBE_SETUP_CLIENT_ID;
        await updateUserState(supabase, userState, userId);
        await sendYouTubeSetupStep2(bot, chatId);
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send the Client Secret.');
      }
      break;

    case STATES.YOUTUBE_SETUP_CLIENT_ID:
      if (text && text.trim().length > 0) {
        userState.userId = userId.toString();
        userState.youtubeClientId = text.trim();
        userState.state = STATES.YOUTUBE_SETUP_REFRESH_TOKEN;
        await updateUserState(supabase, userState, userId);
        await sendYouTubeSetupStep3(bot, chatId);
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send the Client ID.');
      }
      break;

    case STATES.YOUTUBE_SETUP_REFRESH_TOKEN:
      if (text && text.trim().length > 0) {
        await bot.sendMessage(chatId, '🔍 Verifying channel credentials...');
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send the Refresh Token.');
      }
      break;

    case STATES.WAITING_YOUTUBE_DESCRIPTION:
      if (text && text.trim().length > 0) {
        await bot.sendMessage(chatId, '📤 Uploading the video to YouTube...');
      } else {
        await bot.sendMessage(chatId, '⚠️ Please send the video description.');
      }
      break;

    default:
      await bot.sendMessage(chatId, '👋 Use the buttons below to get started', getMainKeyboard());
  }
}

// Polling removed - now using callback only
