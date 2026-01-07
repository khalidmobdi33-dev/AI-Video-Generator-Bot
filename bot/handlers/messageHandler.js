import { getUserState, updateUserState, createUserTask, saveYouTubeChannel, getYouTubeChannel, saveGeneratedVideo } from '../../db/database.js';
import { validateVideo, validateImage } from '../../utils/validators.js';
import { sendWelcomeMessage, sendVideoRequest, sendImageRequest, sendPromptRequest, sendYouTubeSetupStep1, sendYouTubeSetupStep2, sendYouTubeSetupStep3, sendYouTubeSetupSuccess, getYouTubeUploadKeyboard, getWelcomeMessage, getMainKeyboard } from '../messages.js';
import { startVideoGeneration, checkTaskStatus } from '../../services/kieService.js';
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
    // Always ensure userId is set from the current message
    // This is critical because userId might be missing from DB or corrupted
    userState.userId = userId.toString();
    console.log(`[${timestamp}] DEBUG: Set userId to ${userState.userId} for existing user state`);
    
    // Ensure temporary fields are set (they might be null from DB)
    if (userState.youtubeClientSecret === undefined) {
      userState.youtubeClientSecret = null;
    }
    if (userState.youtubeClientId === undefined) {
      userState.youtubeClientId = null;
    }
    if (userState.currentMessageId === undefined) {
      userState.currentMessageId = null;
    }
    
    console.log(`[${timestamp}] DEBUG: Current state: ${userState.state}, youtubeClientSecret: ${userState.youtubeClientSecret ? 'exists' : 'null'}, youtubeClientId: ${userState.youtubeClientId ? 'exists' : 'null'}`);
  }
  
  // Final check before any operation
  if (!userState.userId) {
    console.error(`[${timestamp}] CRITICAL ERROR: userState.userId is still missing after initialization!`);
    userState.userId = userId.toString();
  }

  // Handle commands
  if (text && text.startsWith('/')) {
    if (text === '/start') {
      console.log(`[${timestamp}] User ${userId} started the bot`);
      await sendWelcomeMessage(bot, chatId);
      userState.userId = userId.toString(); // Ensure userId is set
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
      console.log(`[${timestamp}] User ${userId} cancelled operation`);
      userState.userId = userId.toString(); // Ensure userId is set
      userState.state = STATES.IDLE;
      userState.videoFileId = null;
      userState.imageFileId = null;
      userState.videoUrl = null;
      userState.imageUrl = null;
      userState.prompt = null;
      userState.taskId = null;
      await updateUserState(supabase, userState, userId);
      await bot.sendMessage(chatId, '✅ تم إلغاء العملية. ابدأ من جديد باستخدام /start');
      return;
    }
  }

  // Handle state-based messages
  console.log(`[${timestamp}] DEBUG: About to switch on state: "${userState.state}"`);
  console.log(`[${timestamp}] DEBUG: Available states - IDLE: "${STATES.IDLE}", YOUTUBE_SETUP_CLIENT_ID: "${STATES.YOUTUBE_SETUP_CLIENT_ID}"`);
  switch (userState.state) {
    case STATES.IDLE:
      if (text === '/start') {
        // Check if this is first time user
        const isFirstTime = !userState.videoFileId && !userState.imageFileId && !userState.prompt;
        
        if (isFirstTime) {
          await bot.sendMessage(chatId, getWelcomeMessage(), getMainKeyboard());
        } else {
          await sendWelcomeMessage(bot, chatId);
        }
        // Don't start video generation automatically - wait for button press
      } else if (text === '🎬 بدء توليد فيديو جديد' || text === 'بدء توليد فيديو جديد') {
        userState.userId = userId.toString();
        userState.state = STATES.WAITING_VIDEO;
        await updateUserState(supabase, userState, userId);
        const videoMsg = await sendVideoRequest(bot, chatId);
        if (videoMsg) {
          userState.currentMessageId = videoMsg.message_id;
          await updateUserState(supabase, userState, userId);
        }
      } else if (text === '📚 مكتبة الفيديوهات' || text === 'مكتبة الفيديوهات') {
        // Handle video library from message handler
        const { handleVideoLibrary } = await import('./videoLibraryHandler.js');
        await handleVideoLibrary(bot, chatId, userId, supabase, null);
      } else if (text === '⚙️ إعداد قناة يوتيوب' || text === 'إعداد قناة يوتيوب') {
        // Check if channel already exists
        const youtubeChannel = await getYouTubeChannel(supabase, userId);
        if (youtubeChannel) {
          // Channel exists - show options
          const keyboard = {
            keyboard: [
              [
                { text: '🔄 تغيير إعدادات القناة' },
                { text: '🗑️ حذف القناة' }
              ],
              [
                { text: '🔙 القائمة الرئيسية' }
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
          };
          await bot.sendMessage(chatId, `⚙️ إعدادات قناة يوتيوب\n\n✅ القناة معدة: ${youtubeChannel.channel_title || 'قناة يوتيوب'}\n\nاختر الإجراء المطلوب:`, { reply_markup: keyboard });
        } else {
          // No channel - start setup
          userState.userId = userId.toString();
          userState.state = STATES.YOUTUBE_SETUP_CLIENT_SECRET;
          await updateUserState(supabase, userState, userId);
          await sendYouTubeSetupStep1(bot, chatId);
        }
      } else if (text === '🔄 تغيير إعدادات القناة' || text === 'تغيير إعدادات القناة') {
        userState.userId = userId.toString();
        userState.state = STATES.YOUTUBE_SETUP_CLIENT_SECRET;
        await updateUserState(supabase, userState, userId);
        await sendYouTubeSetupStep1(bot, chatId);
      } else if (text === '🗑️ حذف القناة' || text === 'حذف القناة') {
        // Delete YouTube channel
        const { deleteYouTubeChannel } = await import('../../db/database.js');
        try {
          await deleteYouTubeChannel(supabase, userId);
          await bot.sendMessage(chatId, '✅ تم حذف قناة يوتيوب بنجاح.', getMainKeyboard());
        } catch (error) {
          await bot.sendMessage(chatId, '❌ حدث خطأ أثناء حذف القناة.', getMainKeyboard());
        }
      } else if (text === '📺 رفع على يوتيوب' || text === 'رفع على يوتيوب') {
        // Check if video is selected from library
        if (userState.selectedVideoTaskId) {
          // Use selected video from library
          const { getGeneratedVideoByTaskId } = await import('../../db/database.js');
          const video = await getGeneratedVideoByTaskId(supabase, userState.selectedVideoTaskId);
          if (video) {
            // Request video description for YouTube upload
            userState.userId = userId.toString();
            userState.state = STATES.WAITING_YOUTUBE_DESCRIPTION;
            userState.uploadTaskId = video.task_id;
            await updateUserState(supabase, userState, userId);
            await bot.sendMessage(chatId, '✍️ يرجى إرسال وصف الفيديو الذي سيظهر على يوتيوب:\n\nمثال: "فيديو رائع عن الذكاء الاصطناعي"\n\n📝 اكتب الوصف الآن 👇');
            return;
          }
        }
        
        // Otherwise, use last generated video
        // Request video description for YouTube upload
        userState.userId = userId.toString();
        userState.state = STATES.WAITING_YOUTUBE_DESCRIPTION;
        await updateUserState(supabase, userState, userId);
        await bot.sendMessage(chatId, '✍️ يرجى إرسال وصف الفيديو الذي سيظهر على يوتيوب:\n\nمثال: "فيديو رائع عن الذكاء الاصطناعي"\n\n📝 اكتب الوصف الآن 👇');
      } else if (text === '🔙 القائمة الرئيسية' || text === 'القائمة الرئيسية') {
        await bot.sendMessage(chatId, '👋 القائمة الرئيسية', getMainKeyboard());
      } else if (text && text.startsWith('🎬')) {
        // Video selected from library
        const { handleViewVideoFromButton } = await import('./videoLibraryHandler.js');
        await handleViewVideoFromButton(bot, chatId, userId, text, supabase);
      } else {
        await bot.sendMessage(chatId, '👋 استخدم الأزرار أدناه للبدء', getMainKeyboard());
      }
      break;

    case STATES.WAITING_VIDEO:
      if (msg.video || msg.document) {
        const fileId = msg.video ? msg.video.file_id : msg.document.file_id;
        const fileName = msg.video ? msg.video.file_name : msg.document.file_name;
        const mimeType = msg.video ? msg.video.mime_type : msg.document.mime_type;
        
        console.log(`[${timestamp}] User ${userId} uploaded video: ${fileName || fileId}, mime: ${mimeType}`);
        
        try {
          // Get file info
          const file = await bot.getFile(fileId);
          const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
          
          // Validate video first (size check)
          const validation = await validateVideo(fileUrl, file.file_size);
          if (!validation.valid) {
            console.log(`[${timestamp}] Video validation failed for user ${userId}: ${validation.error}`);
            await bot.sendMessage(chatId, `❌ خطأ في الفيديو:\n${validation.error}\n\nيرجى إرسال فيديو صحيح.`);
            return;
          }
          
          // Check if video needs conversion
          let finalVideoUrl = fileUrl;
          let convertedVideo = null;
          
          const videoConverter = await import('../../utils/videoConverter.js');
          const needsConversion = !videoConverter.isFormatSupported(fileName || fileUrl, mimeType);
          
          if (needsConversion) {
            console.log(`[${timestamp}] Video format not supported, converting...`);
            await bot.sendMessage(chatId, '🔄 جاري تحويل الفيديو إلى صيغة مدعومة...');
            
            try {
              convertedVideo = await convertVideoIfNeeded(fileUrl, mimeType, fileName);
              
              if (convertedVideo.converted && convertedVideo.localPath) {
                // Upload converted video to Supabase Storage
                console.log(`[${timestamp}] Uploading converted video to storage...`);
                finalVideoUrl = await uploadVideoToStorage(convertedVideo.localPath, fileName || 'video.mp4');
                
                // Clean up local file
                if (convertedVideo.cleanup) {
                  await convertedVideo.cleanup();
                }
                
                console.log(`[${timestamp}] Video converted and uploaded: ${finalVideoUrl}`);
              }
            } catch (convertError) {
              console.error(`[${timestamp}] Error converting video:`, convertError);
              await bot.sendMessage(chatId, `⚠️ حدث خطأ أثناء تحويل الفيديو:\n${convertError.message}\n\nسيتم استخدام الفيديو الأصلي.`);
              // Continue with original video
            }
          }

          // Save video info
          // CRITICAL: Always set userId before updating state
          userState.userId = userId.toString();
          userState.videoFileId = fileId;
          userState.videoUrl = finalVideoUrl;
          userState.state = STATES.WAITING_IMAGE;
          
          // Debug log before update
          console.log(`[${timestamp}] DEBUG: Before updateUserState - userId: ${userState.userId}, state: ${userState.state}`);
          
          // Pass userId as parameter for safety
          await updateUserState(supabase, userState, userId);
          
          console.log(`[${timestamp}] Video processed successfully for user ${userId}, URL: ${finalVideoUrl}`);
          
          // Delete previous message
          if (userState.currentMessageId) {
            try {
              await bot.deleteMessage(chatId, userState.currentMessageId);
            } catch (e) {
              // Ignore if already deleted
            }
          }
          
          await bot.sendMessage(chatId, '✅ تم استلام الفيديو بنجاح!');
          const imageMsg = await sendImageRequest(bot, chatId);
          if (imageMsg) {
            userState.currentMessageId = imageMsg.message_id;
            await updateUserState(supabase, userState, userId);
          }
        } catch (error) {
          console.error(`[${timestamp}] Error processing video:`, error);
          await bot.sendMessage(chatId, `❌ حدث خطأ أثناء معالجة الفيديو:\n${error.message}\n\nيرجى المحاولة مرة أخرى.`);
        }
      } else {
        await bot.sendMessage(chatId, '⚠️ يرجى إرسال فيديو.');
      }
      break;

    case STATES.WAITING_IMAGE:
      // Handle cancel via button
      if (text === '🔙 القائمة الرئيسية' || text === 'القائمة الرئيسية') {
        userState.userId = userId.toString();
        userState.state = STATES.IDLE;
        userState.videoFileId = null;
        userState.imageFileId = null;
        userState.videoUrl = null;
        userState.imageUrl = null;
        userState.prompt = null;
        userState.taskId = null;
        if (userState.currentMessageId) {
          try {
            await bot.deleteMessage(chatId, userState.currentMessageId);
          } catch (e) {}
        }
        await updateUserState(supabase, userState, userId);
        await bot.sendMessage(chatId, '✅ تم إلغاء العملية.', getMainKeyboard());
        return;
      }
      
      if (msg.photo || msg.document) {
        let fileId, file;
        
        if (msg.photo) {
          // Get the largest photo
          const photo = msg.photo[msg.photo.length - 1];
          fileId = photo.file_id;
          file = await bot.getFile(fileId);
        } else if (msg.document) {
          fileId = msg.document.file_id;
          file = await bot.getFile(fileId);
        }
        
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
        const fileName = msg.document ? msg.document.file_name : 'photo.jpg';
        
        console.log(`[${timestamp}] User ${userId} uploaded image: ${fileName || fileId}`);
        
        try {
          // Validate image
          const validation = await validateImage(fileUrl, file.file_size);
          if (!validation.valid) {
            console.log(`[${timestamp}] Image validation failed for user ${userId}: ${validation.error}`);
            await bot.sendMessage(chatId, `❌ خطأ في الصورة:\n${validation.error}\n\nيرجى إرسال صورة صحيحة.`);
            return;
          }

          // Save image info
          userState.userId = userId.toString(); // Ensure userId is set
          userState.imageFileId = fileId;
          userState.imageUrl = fileUrl;
          userState.state = STATES.WAITING_PROMPT;
          await updateUserState(supabase, userState, userId);
          
          console.log(`[${timestamp}] Image validated successfully for user ${userId}`);
          
          // Delete previous message
          if (userState.currentMessageId) {
            try {
              await bot.deleteMessage(chatId, userState.currentMessageId);
            } catch (e) {
              // Ignore if already deleted
            }
          }
          
          await bot.sendMessage(chatId, '✅ تم استلام الصورة بنجاح!');
          const promptMsg = await sendPromptRequest(bot, chatId);
          if (promptMsg) {
            userState.currentMessageId = promptMsg.message_id;
            await updateUserState(supabase, userState, userId);
          }
        } catch (error) {
          console.error(`[${timestamp}] Error processing image:`, error);
          await bot.sendMessage(chatId, `❌ حدث خطأ أثناء معالجة الصورة:\n${error.message}\n\nيرجى المحاولة مرة أخرى.`);
        }
      } else {
        await bot.sendMessage(chatId, '⚠️ يرجى إرسال صورة.');
      }
      break;

    case STATES.WAITING_PROMPT:
      if (text && text.trim().length > 0) {
        if (text.length > 2500) {
          await bot.sendMessage(chatId, '❌ البرومبت طويل جداً. الحد الأقصى هو 2500 حرف.\n\nيرجى إرسال برومبت أقصر.');
          return;
        }

        console.log(`[${timestamp}] User ${userId} provided prompt: ${text.substring(0, 50)}...`);
        
        userState.userId = userId.toString(); // Ensure userId is set
        userState.prompt = text.trim();
        userState.state = STATES.GENERATING;
        await updateUserState(supabase, userState, userId);
        
        await bot.sendMessage(chatId, '✅ تم استلام البرومبت! جاري بدء توليد الفيديو...');
        
        // Start video generation
        try {
          const taskId = await startVideoGeneration(userState, supabase);
          userState.userId = userId.toString(); // Ensure userId is set
          userState.taskId = taskId;
          await updateUserState(supabase, userState, userId);
          
          // Create task record in database
          await createUserTask(supabase, userId, chatId, taskId);
          
          console.log(`[${timestamp}] Started video generation for user ${userId}, taskId: ${taskId}`);
          
          // Start polling for status
          startStatusPolling(bot, chatId, userId, taskId, supabase);
        } catch (error) {
          console.error(`[${timestamp}] Error starting video generation:`, error);
          userState.userId = userId.toString(); // Ensure userId is set
          userState.state = STATES.IDLE;
          await updateUserState(supabase, userState, userId);
          
          let errorMessage = '❌ حدث خطأ أثناء بدء توليد الفيديو.';
          if (error.response?.data?.message) {
            errorMessage += `\n\nالتفاصيل:\n${error.response.data.message}`;
          } else if (error.message) {
            errorMessage += `\n\nالتفاصيل:\n${error.message}`;
          }
          await bot.sendMessage(chatId, errorMessage);
        }
      } else {
          await bot.sendMessage(chatId, '⚠️ يرجى إرسال وصف نصي (برومبت) للفيديو.');
      }
      break;

    case STATES.GENERATING:
      await bot.sendMessage(chatId, '⏳ جاري توليد الفيديو حالياً. يرجى الانتظار...');
      break;

    case STATES.YOUTUBE_SETUP_CLIENT_SECRET:
      console.log(`[${timestamp}] DEBUG: In YOUTUBE_SETUP_CLIENT_SECRET state`);
      if (text && text.trim().length > 0) {
        const clientSecret = text.trim();
        userState.userId = userId.toString();
        userState.youtubeClientSecret = clientSecret; // Temporary storage
        userState.state = STATES.YOUTUBE_SETUP_CLIENT_ID;
        console.log(`[${timestamp}] DEBUG: Saving clientSecret, updating state to: ${STATES.YOUTUBE_SETUP_CLIENT_ID}`);
        await updateUserState(supabase, userState, userId);
        await sendYouTubeSetupStep2(bot, chatId);
      } else {
        await bot.sendMessage(chatId, '⚠️ يرجى إرسال Client Secret.');
      }
      break;

    case STATES.YOUTUBE_SETUP_CLIENT_ID:
      console.log(`[${timestamp}] DEBUG: In YOUTUBE_SETUP_CLIENT_ID state, youtubeClientSecret: ${userState.youtubeClientSecret ? 'exists' : 'null/undefined'}`);
      if (text && text.trim().length > 0) {
        const clientId = text.trim();
        const clientSecret = userState.youtubeClientSecret;
        
        console.log(`[${timestamp}] DEBUG: Received Client ID, checking clientSecret: ${clientSecret ? 'exists' : 'missing'}`);
        
        if (!clientSecret) {
          console.error(`[${timestamp}] ERROR: youtubeClientSecret is missing in state!`);
          await bot.sendMessage(chatId, '❌ حدث خطأ. يرجى إعادة إعداد القناة من البداية.\n\nالسبب: لم يتم العثور على Client Secret المحفوظ.');
          userState.userId = userId.toString();
          userState.state = STATES.IDLE;
          await updateUserState(supabase, userState, userId);
          return;
        }
        
        userState.userId = userId.toString();
        userState.youtubeClientId = clientId; // Temporary storage
        userState.state = STATES.YOUTUBE_SETUP_REFRESH_TOKEN;
        await updateUserState(supabase, userState, userId);
        await sendYouTubeSetupStep3(bot, chatId);
      } else {
        await bot.sendMessage(chatId, '⚠️ يرجى إرسال Client ID.');
      }
      break;

    case STATES.YOUTUBE_SETUP_REFRESH_TOKEN:
      if (text && text.trim().length > 0) {
        const refreshToken = text.trim();
        const clientSecret = userState.youtubeClientSecret;
        const clientId = userState.youtubeClientId;
        
        if (!clientSecret || !clientId) {
          await bot.sendMessage(chatId, '❌ حدث خطأ. يرجى إعادة إعداد القناة من البداية.');
          userState.userId = userId.toString();
          userState.state = STATES.IDLE;
          await updateUserState(supabase, userState, userId);
          return;
        }
        
        // Verify credentials
        await bot.sendMessage(chatId, '🔍 جاري التحقق من بيانات القناة...');
        const verification = await verifyYouTubeCredentials(clientId, clientSecret, refreshToken);
        
        if (verification.valid) {
          // Save channel configuration
          await saveYouTubeChannel(supabase, userId, clientSecret, clientId, refreshToken, verification.channelId, verification.channelTitle);
          
          userState.userId = userId.toString();
          userState.state = STATES.IDLE;
          userState.youtubeClientSecret = null; // Clear temporary data
          userState.youtubeClientId = null; // Clear temporary data
          await updateUserState(supabase, userState, userId);
          
          await sendYouTubeSetupSuccess(bot, chatId, verification.channelTitle);
        } else {
          await bot.sendMessage(chatId, `❌ فشل التحقق من بيانات القناة:\n${verification.error}\n\nيرجى التحقق من البيانات والمحاولة مرة أخرى.`);
        }
      } else {
        await bot.sendMessage(chatId, '⚠️ يرجى إرسال Refresh Token.');
      }
      break;

    case STATES.WAITING_YOUTUBE_DESCRIPTION:
      // Handle cancel via button
      if (text === '🔙 القائمة الرئيسية' || text === 'القائمة الرئيسية') {
        userState.userId = userId.toString();
        userState.state = STATES.IDLE;
        userState.uploadTaskId = null;
        userState.selectedVideoTaskId = null;
        await updateUserState(supabase, userState, userId);
        await bot.sendMessage(chatId, '✅ تم إلغاء العملية.', getMainKeyboard());
        return;
      }
      
      if (text && text.trim().length > 0) {
        const videoDescription = text.trim();
        
        // Check if specific video is selected
        let taskId = userState.uploadTaskId || userState.selectedVideoTaskId;
        let videoUrl = null;
        
        if (taskId) {
          // Use selected video
          const { getGeneratedVideoByTaskId } = await import('../../db/database.js');
          const video = await getGeneratedVideoByTaskId(supabase, taskId);
          if (video) {
            videoUrl = video.video_url;
            taskId = video.task_id;
          }
        }
        
        // If no specific video, get last generated video
        if (!videoUrl) {
          const { getUserGeneratedVideos } = await import('../../db/database.js');
          const videos = await getUserGeneratedVideos(supabase, userId, 1);
          
          if (!videos || videos.length === 0) {
            await bot.sendMessage(chatId, '❌ لم يتم العثور على فيديو منشأ. يرجى توليد فيديو جديد أولاً.', getMainKeyboard());
            userState.userId = userId.toString();
            userState.state = STATES.IDLE;
            await updateUserState(supabase, userState, userId);
            return;
          }
          
          const video = videos[0];
          videoUrl = video.video_url;
          taskId = video.task_id;
        }
        
        // Upload to YouTube
        await handleYouTubeUploadWithDescription(bot, chatId, userId, videoUrl, videoDescription, taskId, supabase);
        
        // Reset state
        userState.userId = userId.toString();
        userState.state = STATES.IDLE;
        userState.uploadTaskId = null;
        userState.selectedVideoTaskId = null;
        await updateUserState(supabase, userState, userId);
      } else {
        await bot.sendMessage(chatId, '⚠️ يرجى إرسال وصف الفيديو.');
      }
      break;

    default:
      console.log(`[${timestamp}] DEBUG: Unknown state: ${userState.state}, sending default message`);
      await bot.sendMessage(chatId, '👋 استخدم الأزرار أدناه للبدء', getMainKeyboard());
  }
}

// Helper function to handle YouTube upload with description
async function handleYouTubeUploadWithDescription(bot, chatId, userId, videoUrl, description, taskId, supabase) {
  const timestamp = new Date().toISOString();
  
  try {
    // Check if YouTube channel is configured
    const youtubeChannel = await getYouTubeChannel(supabase, userId);
    
    if (!youtubeChannel) {
      await bot.sendMessage(chatId, '⚠️ لم يتم إعداد قناة يوتيوب بعد.\n\nيرجى إعداد القناة أولاً باستخدام زر "⚙️ إعداد قناة يوتيوب"', getMainKeyboard());
      return;
    }
    
    // Create upload record
    const { createYouTubeUpload, updateYouTubeUpload } = await import('../../db/database.js');
    const uploadRecord = await createYouTubeUpload(supabase, userId, taskId, videoUrl);
    
    // Send uploading message
    const uploadingMsg = await bot.sendMessage(chatId, '📤 جاري رفع الفيديو على يوتيوب...');
    
    try {
      // Upload to YouTube
      const { uploadToYouTube } = await import('../../services/youtubeService.js');
      const uploadResult = await uploadToYouTube(
        videoUrl,
        description,
        `تم توليد هذا الفيديو باستخدام الذكاء الاصطناعي\n\nالوصف: ${description}`,
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
      await bot.deleteMessage(chatId, uploadingMsg.message_id).catch(() => {});
      
      // Send success message with link
      await bot.sendMessage(
        chatId,
        `✅ تم نشر الفيديو على يوتيوب بنجاح!\n\n📺 رابط الفيديو:\n${uploadResult.shortsUrl}\n\n🎉 يمكنك الآن مشاهدته على قناتك!`,
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
        `❌ فشل رفع الفيديو على يوتيوب.\n\nالتفاصيل:\n${uploadError.message}\n\nيرجى التحقق من إعدادات القناة والمحاولة مرة أخرى.`,
        getMainKeyboard()
      );
    }
  } catch (error) {
    console.error(`[${timestamp}] Error uploading video to YouTube:`, error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.', getMainKeyboard());
  }
}

// Poll for task status
async function startStatusPolling(bot, chatId, userId, taskId, supabase) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting status polling for task ${taskId}`);
  
  let loadingMessageId = null;
  const loadingEmojis = ['⏳', '🔄', '⏳', '🔄'];
  let emojiIndex = 0;
  
  // Send initial loading message
  try {
    const loadingMsg = await bot.sendMessage(chatId, `${loadingEmojis[0]} جاري توليد الفيديو...`);
    loadingMessageId = loadingMsg.message_id;
  } catch (error) {
    console.error(`[${timestamp}] Error sending loading message:`, error);
  }
  
  // Update loading message every 3 seconds
  const loadingInterval = setInterval(async () => {
    try {
      if (loadingMessageId) {
        emojiIndex = (emojiIndex + 1) % loadingEmojis.length;
        await bot.editMessageText(
          `${loadingEmojis[emojiIndex]} جاري توليد الفيديو...`,
          { chat_id: chatId, message_id: loadingMessageId }
        );
      }
    } catch (error) {
      // Ignore edit errors (message might be deleted)
    }
  }, 3000);
  
  // Poll for status every 5 seconds
  const pollInterval = setInterval(async () => {
    try {
      const status = await checkTaskStatus(taskId);
      
      const statusTimestamp = new Date().toISOString();
      console.log(`[${statusTimestamp}] Task ${taskId} status: ${status.state}`);
      
      if (status.state === 'success') {
        clearInterval(pollInterval);
        clearInterval(loadingInterval);
        
        // Delete loading message
        if (loadingMessageId) {
          try {
            await bot.deleteMessage(chatId, loadingMessageId);
          } catch (error) {
            // Ignore
          }
        }
        
        // Get result URLs
        const resultJson = JSON.parse(status.resultJson);
        const videoUrl = resultJson.resultUrls?.[0];
        
        if (videoUrl) {
          console.log(`[${statusTimestamp}] Task ${taskId} completed successfully, sending video to user ${userId}`);
          
          // Get user state to get prompt for library
          const userState = await getUserState(supabase, userId);
          const prompt = userState?.prompt || null;
          
          // Save video to library
          try {
            await saveGeneratedVideo(supabase, userId, taskId, videoUrl, prompt);
            console.log(`[${statusTimestamp}] Video saved to library: taskId ${taskId}`);
          } catch (saveError) {
            console.error(`[${statusTimestamp}] Error saving video to library:`, saveError);
            // Continue even if save fails
          }
          
          // Check if YouTube is configured
          const youtubeChannel = await getYouTubeChannel(supabase, userId);
          const hasYouTube = youtubeChannel !== null;
          
          // Delete loading message
          if (loadingMessageId) {
            try {
              await bot.deleteMessage(chatId, loadingMessageId);
            } catch (e) {
              // Ignore if already deleted
            }
          }
          
          // Delete previous messages if they exist
          if (userState && userState.currentMessageId) {
            try {
              await bot.deleteMessage(chatId, userState.currentMessageId);
            } catch (e) {
              // Ignore if already deleted
            }
          }
          
          await bot.sendMessage(chatId, '✅ تم توليد الفيديو بنجاح!');
          await bot.sendVideo(chatId, videoUrl, hasYouTube ? getYouTubeUploadKeyboard() : getMainKeyboard());
          
          // Reset user state (but keep taskId for reference)
          if (userState) {
            userState.userId = userId.toString(); // Ensure userId is set
            userState.state = 'idle';
            // Don't clear taskId - keep it for reference, but it's now in library
            await updateUserState(supabase, userState, userId);
          }
        } else {
          throw new Error('No video URL in result');
        }
      } else if (status.state === 'fail') {
        clearInterval(pollInterval);
        clearInterval(loadingInterval);
        
        // Delete loading message
        if (loadingMessageId) {
          try {
            await bot.deleteMessage(chatId, loadingMessageId);
          } catch (error) {
            // Ignore
          }
        }
        
        const errorTimestamp = new Date().toISOString();
        console.error(`[${errorTimestamp}] Task ${taskId} failed: ${status.failMsg}`);
        
        let errorMessage = '❌ فشل توليد الفيديو.';
        if (status.failMsg) {
          errorMessage += `\n\nالتفاصيل:\n${status.failMsg}`;
        }
        if (status.failCode) {
          errorMessage += `\n\nرمز الخطأ: ${status.failCode}`;
        }
        
        await bot.sendMessage(chatId, errorMessage);
        
        // Reset user state
        const userState = await getUserState(supabase, userId);
        if (userState) {
          userState.userId = userId.toString(); // Ensure userId is set
          userState.state = 'idle';
          userState.taskId = null;
          await updateUserState(supabase, userState, userId);
        }
      }
      // Continue polling for other states (waiting, queuing, generating)
    } catch (error) {
      const errorTimestamp = new Date().toISOString();
      console.error(`[${errorTimestamp}] Error polling task status:`, error);
      
      // Don't clear intervals on error, continue polling
    }
  }, 5000);
  
  // Timeout after 10 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
    clearInterval(loadingInterval);
    console.log(`[${new Date().toISOString()}] Status polling timeout for task ${taskId}`);
  }, 600000);
}

