// Reply Keyboard (permanent buttons at bottom)
export function getMainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [
          { text: '🎬 Start Generating a New Video' },
          { text: '📚 Video Library' }
        ],
        [
          { text: '⚙️ Set Up YouTube Channel' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Welcome message for new users
export function getWelcomeMessage() {
  return `👋 Welcome to the AI Video Generation Bot!

🤖 **What you can do:**
• 🎬 Generate new videos using AI
• 📚 Access the generated video library
• 📺 Publish videos directly to YouTube

🚀 **How to use:**
1. Press "🎬 Start Generating a New Video"
2. Send the base video
3. Send the image
4. Write the video description (prompt)
5. Wait until the video is generated

💡 **Tip:** You can set up a YouTube channel to publish videos directly!

Start now using the buttons below 👇`;
}

export async function sendWelcomeMessage(bot, chatId) {
  const message = `👋 Welcome to the Video Generation Bot!

🎬 This bot helps you generate videos using artificial intelligence.

📋 Steps:
1️⃣ Send the reference video (3–30 seconds)
2️⃣ Send the reference image
3️⃣ Write the desired video description (prompt)

Use the buttons below to get started 👇`;
  
  await bot.sendMessage(chatId, message, getMainKeyboard());
}

export async function sendVideoRequest(bot, chatId, messageId = null) {
  const message = `📹 Step 1/3: Send the reference video

📌 Requirements:
• Duration: 3–30 seconds
• The head, shoulders, and torso must be clearly visible
• Supported formats: MP4, MOV, MKV
• Maximum size: 100 MB

Please send the video now 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendImageRequest(bot, chatId, messageId = null) {
  const message = `🖼️ Step 2/3: Send the reference image

📌 Requirements:
• The head, shoulders, and torso must be clearly visible
• Supported formats: JPEG, PNG, WEBP
• Maximum size: 10 MB

Please send the image now 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendPromptRequest(bot, chatId, messageId = null) {
  const message = `✍️ Step 3/3: Write the video description (prompt)

📝 Write a text description of the video you want to generate.
Example: "The cartoon character is dancing"

📌 Maximum length: 2500 characters

Please send the description now 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export function getYouTubeUploadKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📺 Publish now on YouTube', callback_data: 'upload_youtube' }
        ]
      ]
    }
  };
}

export async function sendYouTubeSetupStep1(bot, chatId, messageId = null) {
  const message = `⚙️ YouTube Channel Setup – Step 1/3

🔐 Please send your Client Secret.

📝 How to get the Client Secret:
1. Go to Google Cloud Console
2. Select your project or create a new one
3. Enable YouTube Data API v3
4. Go to "Credentials"
5. Create an OAuth 2.0 Client ID (if it doesn’t exist)
6. Copy the "Client Secret" and send it here

Please send the Client Secret now 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendYouTubeSetupStep2(bot, chatId, messageId = null) {
  const message = `⚙️ YouTube Channel Setup – Step 2/3

🆔 Please send your Client ID.

📝 How to get the Client ID:
1. On the same Credentials page in Google Cloud Console
2. Find the OAuth 2.0 Client ID you created
3. Copy the "Client ID" and send it here

Please send the Client ID now 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendYouTubeSetupStep3(bot, chatId, messageId = null) {
  const message = `⚙️ YouTube Channel Setup – Step 3/3

🔄 Please send your Refresh Token.

📝 How to get the Refresh Token:
1. Use OAuth 2.0 Playground or a similar tool
2. Select YouTube Data API v3
3. Choose the required scopes (upload, manage)
4. Complete the authentication process
5. Copy the "Refresh Token" and send it here

Please send the Refresh Token now 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendYouTubeSetupSuccess(bot, chatId, channelTitle, messageId = null) {
  const message = `✅ YouTube channel has been set up successfully!

📺 Channel: ${channelTitle}

You can now publish videos directly to YouTube from the bot.`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    await bot.sendMessage(chatId, message);
  }
}
