/**
 * Database operations for user states and tasks
 */

/**
 * Get user state from database
 */
export async function getUserState(supabase, userId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Getting user state for user ${userId}`);

  try {
    const { data, error } = await supabase
      .from('user_states')
      .select('*')
      .eq('user_id', userId.toString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.log(`[${timestamp}] No state found for user ${userId}`);
        return null;
      }
      console.error(`[${timestamp}] Error getting user state:`, error);
      throw error;
    }

    // Convert database format (snake_case) to code format (camelCase)
    if (data) {
      return {
        userId: data.user_id,
        state: data.state,
        videoFileId: data.video_file_id,
        imageFileId: data.image_file_id,
        videoUrl: data.video_url,
        imageUrl: data.image_url,
        prompt: data.prompt,
        taskId: data.task_id,
        currentMessageId: data.current_message_id,
        youtubeClientSecret: data.youtube_client_secret,
        youtubeClientId: data.youtube_client_id
      };
    }

    return null;
  } catch (error) {
    console.error(`[${timestamp}] Error in getUserState:`, error);
    throw error;
  }
}

/**
 * Update or create user state
 */
export async function updateUserState(supabase, userState, userId = null) {
  const timestamp = new Date().toISOString();
  
  // Debug: Log the entire userState object
  console.log(`[${timestamp}] DEBUG updateUserState - userState object:`, JSON.stringify(userState, null, 2));
  console.log(`[${timestamp}] DEBUG updateUserState - userId parameter:`, userId);
  
  // Ensure userId is set - use parameter if userState.userId is missing
  let userIdStr = null;
  
  if (userState && userState.userId) {
    userIdStr = userState.userId.toString();
  } else if (userId) {
    userIdStr = userId.toString();
    // Fix userState if userId was provided
    if (userState) {
      userState.userId = userIdStr;
    }
  }
  
  if (!userIdStr) {
    console.error(`[${timestamp}] ERROR: userState.userId and userId parameter are both missing!`, { userState, userId });
    throw new Error('userState.userId is required');
  }
  
  console.log(`[${timestamp}] Updating user state for user ${userIdStr}, state: ${userState?.state || 'unknown'}`);

  try {
    const { data, error } = await supabase
      .from('user_states')
      .upsert({
        user_id: userIdStr,
        state: userState.state,
        video_file_id: userState.videoFileId,
        image_file_id: userState.imageFileId,
        video_url: userState.videoUrl,
        image_url: userState.imageUrl,
        prompt: userState.prompt,
        task_id: userState.taskId,
        current_message_id: userState.currentMessageId,
        youtube_client_secret: userState.youtubeClientSecret,
        youtube_client_id: userState.youtubeClientId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error(`[${timestamp}] Error updating user state:`, error);
      throw error;
    }

    // Convert back to camelCase format
    if (data) {
      return {
        userId: data.user_id,
        state: data.state,
        videoFileId: data.video_file_id,
        imageFileId: data.image_file_id,
        videoUrl: data.video_url,
        imageUrl: data.image_url,
        prompt: data.prompt,
        taskId: data.task_id,
        currentMessageId: data.current_message_id,
        youtubeClientSecret: data.youtube_client_secret,
        youtubeClientId: data.youtube_client_id
      };
    }

    return null;
  } catch (error) {
    console.error(`[${timestamp}] Error in updateUserState:`, error);
    throw error;
  }
}

/**
 * Create a new task record
 */
export async function createUserTask(supabase, userId, chatId, taskId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Creating task record: ${taskId} for user ${userId}`);

  try {
    const { data, error } = await supabase
      .from('user_tasks')
      .insert({
        user_id: userId.toString(),
        chat_id: chatId.toString(),
        task_id: taskId,
        state: 'waiting',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error(`[${timestamp}] Error creating task:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in createUserTask:`, error);
    throw error;
  }
}

/**
 * Get YouTube channel configuration for user
 */
export async function getYouTubeChannel(supabase, userId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Getting YouTube channel for user ${userId}`);

  try {
    const { data, error } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('user_id', userId.toString())
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`[${timestamp}] No YouTube channel found for user ${userId}`);
        return null;
      }
      console.error(`[${timestamp}] Error getting YouTube channel:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in getYouTubeChannel:`, error);
    throw error;
  }
}

/**
 * Save or update YouTube channel configuration
 */
export async function saveYouTubeChannel(supabase, userId, clientSecret, clientId, refreshToken, channelId = null, channelTitle = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Saving YouTube channel for user ${userId}`);

  try {
    const { data, error } = await supabase
      .from('youtube_channels')
      .upsert({
        user_id: userId.toString(),
        client_secret: clientSecret,
        client_id: clientId,
        refresh_token: refreshToken,
        channel_id: channelId,
        channel_title: channelTitle,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error(`[${timestamp}] Error saving YouTube channel:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in saveYouTubeChannel:`, error);
    throw error;
  }
}

/**
 * Create YouTube upload record
 */
export async function createYouTubeUpload(supabase, userId, taskId, videoUrl) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Creating YouTube upload record for task ${taskId}`);

  try {
    const { data, error } = await supabase
      .from('youtube_uploads')
      .insert({
        user_id: userId.toString(),
        task_id: taskId,
        video_url: videoUrl,
        upload_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error(`[${timestamp}] Error creating YouTube upload:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in createYouTubeUpload:`, error);
    throw error;
  }
}

/**
 * Update YouTube upload status
 */
export async function updateYouTubeUpload(supabase, uploadId, status, youtubeVideoId = null, youtubeVideoUrl = null, errorMessage = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Updating YouTube upload ${uploadId} status to ${status}`);

  try {
    const updateData = {
      upload_status: status,
      updated_at: new Date().toISOString()
    };

    if (youtubeVideoId) updateData.youtube_video_id = youtubeVideoId;
    if (youtubeVideoUrl) updateData.youtube_video_url = youtubeVideoUrl;
    if (errorMessage) updateData.error_message = errorMessage;

    const { data, error } = await supabase
      .from('youtube_uploads')
      .update(updateData)
      .eq('id', uploadId)
      .select()
      .single();

    if (error) {
      console.error(`[${timestamp}] Error updating YouTube upload:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in updateYouTubeUpload:`, error);
    throw error;
  }
}

/**
 * Save generated video to library
 */
export async function saveGeneratedVideo(supabase, userId, taskId, videoUrl, prompt = null, thumbnailUrl = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Saving generated video to library: taskId ${taskId} for user ${userId}`);

  try {
    const { data, error } = await supabase
      .from('generated_videos')
      .upsert({
        user_id: userId.toString(),
        task_id: taskId,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        prompt: prompt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'task_id'
      })
      .select()
      .single();

    if (error) {
      console.error(`[${timestamp}] Error saving generated video:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in saveGeneratedVideo:`, error);
    throw error;
  }
}

/**
 * Get user's generated videos library
 */
export async function getUserGeneratedVideos(supabase, userId, limit = 20) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Getting generated videos for user ${userId}`);

  try {
    const { data, error } = await supabase
      .from('generated_videos')
      .select('*')
      .eq('user_id', userId.toString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[${timestamp}] Error getting generated videos:`, error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error(`[${timestamp}] Error in getUserGeneratedVideos:`, error);
    throw error;
  }
}

/**
 * Get generated video by task ID
 */
export async function getGeneratedVideoByTaskId(supabase, taskId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Getting generated video by taskId: ${taskId}`);

  try {
    const { data, error } = await supabase
      .from('generated_videos')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`[${timestamp}] No generated video found for taskId ${taskId}`);
        return null;
      }
      console.error(`[${timestamp}] Error getting generated video:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[${timestamp}] Error in getGeneratedVideoByTaskId:`, error);
    throw error;
  }
}

