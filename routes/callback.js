import express from 'express';
import { bot } from '../bot/bot.js';
import { getUserState, updateUserState } from '../db/database.js';
import { createSupabaseClient } from '../db/supabase.js';

const router = express.Router();
const supabase = createSupabaseClient();

// Handle kie.ai callback
router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Received callback from kie.ai:`, JSON.stringify(req.body, null, 2));

  try {
    const { taskId, state, resultJson, failCode, failMsg } = req.body;

    if (!taskId) {
      console.error(`[${timestamp}] Callback missing taskId`);
      return res.status(400).json({ error: 'Missing taskId' });
    }

    // Find user by taskId
    const { data: tasks, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('task_id', taskId)
      .limit(1);

    if (error) {
      console.error(`[${timestamp}] Database error finding task:`, error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!tasks || tasks.length === 0) {
      console.log(`[${timestamp}] Task ${taskId} not found in database`);
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];
    const userId = task.user_id;
    const chatId = task.chat_id;

    console.log(`[${timestamp}] Processing callback for task ${taskId}, user ${userId}, state: ${state}`);

    // Update task status
    await supabase
      .from('user_tasks')
      .update({
        state: state,
        result_json: resultJson,
        fail_code: failCode,
        fail_msg: failMsg,
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId);

    // Handle different states
    if (state === 'success') {
      let result = {};
      try {
        result = JSON.parse(resultJson || '{}');
      } catch (parseError) {
        console.error(`[${timestamp}] Error parsing resultJson for task ${taskId}:`, parseError);
        result = {};
      }
      const videoUrl = result.resultUrls?.[0];

      if (videoUrl) {
        console.log(`[${timestamp}] Task ${taskId} completed successfully, sending video to user ${userId}`);
        await bot.sendMessage(chatId, '✅ تم توليد الفيديو بنجاح!');
        await bot.sendVideo(chatId, videoUrl);

        // Reset user state
        const userState = await getUserState(supabase, userId);
        if (userState) {
          userState.userId = userId.toString(); // Ensure userId is set
          userState.state = 'idle';
          userState.taskId = null;
          await updateUserState(supabase, userState, userId);
        }
      } else {
        console.error(`[${timestamp}] No video URL in result for task ${taskId}`);
        await bot.sendMessage(chatId, '❌ تم توليد الفيديو لكن لم يتم العثور على رابط الفيديو.');
      }
    } else if (state === 'fail') {
      console.error(`[${timestamp}] Task ${taskId} failed: ${failMsg}`);
      
      let errorMessage = '❌ فشل توليد الفيديو.';
      if (failMsg) {
        errorMessage += `\n\nالتفاصيل:\n${failMsg}`;
      }
      if (failCode) {
        errorMessage += `\n\nرمز الخطأ: ${failCode}`;
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

    res.json({ success: true });
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] Error processing callback:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as callbackRouter };

