// Reply Keyboard (permanent buttons at bottom)
export function getMainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [
          { text: '🎬 بدء توليد فيديو جديد' },
          { text: '📚 مكتبة الفيديوهات' }
        ],
        [
          { text: '⚙️ إعداد قناة يوتيوب' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Welcome message for new users
export function getWelcomeMessage() {
  return `👋 مرحباً بك في بوت توليد الفيديوهات بالذكاء الاصطناعي!

🤖 **ما يمكنك فعله:**
• 🎬 توليد فيديوهات جديدة باستخدام الذكاء الاصطناعي
• 📚 الوصول إلى مكتبة الفيديوهات المولدة
• 📺 نشر الفيديوهات على يوتيوب مباشرة

🚀 **كيفية الاستخدام:**
1. اضغط "🎬 بدء توليد فيديو جديد"
2. أرسل الفيديو الأساسي
3. أرسل الصورة
4. اكتب وصف الفيديو (برومبت)
5. انتظر حتى يتم توليد الفيديو

💡 **نصيحة:** يمكنك إعداد قناة يوتيوب لنشر الفيديوهات مباشرة!

ابدأ الآن باستخدام الأزرار أدناه 👇`;
}

export async function sendWelcomeMessage(bot, chatId) {
  const message = `👋 مرحباً بك في بوت توليد الفيديوهات!

🎬 هذا البوت يساعدك في توليد فيديوهات باستخدام الذكاء الاصطناعي.

📋 الخطوات:
1️⃣ أرسل الفيديو المرجعي (3-30 ثانية)
2️⃣ أرسل الصورة المرجعية
3️⃣ اكتب وصف الفيديو المطلوب (برومبت)

استخدم الأزرار أدناه للبدء 👇`;
  
  await bot.sendMessage(chatId, message, getMainKeyboard());
}

export async function sendVideoRequest(bot, chatId, messageId = null) {
  const message = `📹 الخطوة 1/3: أرسل الفيديو المرجعي

📌 المتطلبات:
• المدة: 3-30 ثانية
• يجب أن يظهر الرأس والكتفين والجذع بوضوح
• الصيغ المدعومة: MP4, MOV, MKV
• الحجم الأقصى: 100 MB

يرجى إرسال الفيديو الآن 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendImageRequest(bot, chatId, messageId = null) {
  const message = `🖼️ الخطوة 2/3: أرسل الصورة المرجعية

📌 المتطلبات:
• يجب أن تظهر الرأس والكتفين والجذع بوضوح
• الصيغ المدعومة: JPEG, PNG, WEBP
• الحجم الأقصى: 10 MB

يرجى إرسال الصورة الآن 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendPromptRequest(bot, chatId, messageId = null) {
  const message = `✍️ الخطوة 3/3: اكتب وصف الفيديو (برومبت)

📝 اكتب وصفاً نصياً للفيديو الذي تريد توليده.
مثال: "الشخصية الكرتونية ترقص"

📌 الحد الأقصى: 2500 حرف

يرجى إرسال الوصف الآن 👇`;
  
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
          { text: '📺 انشر الآن على يوتيوب', callback_data: 'upload_youtube' }
        ]
      ]
    }
  };
}

export async function sendYouTubeSetupStep1(bot, chatId, messageId = null) {
  const message = `⚙️ إعداد قناة يوتيوب - الخطوة 1/3

🔐 يرجى إرسال Client Secret الخاص بك.

📝 كيفية الحصول على Client Secret:
1. اذهب إلى Google Cloud Console
2. اختر مشروعك أو أنشئ مشروع جديد
3. فعّل YouTube Data API v3
4. اذهب إلى "Credentials"
5. أنشئ OAuth 2.0 Client ID (إذا لم يكن موجوداً)
6. انسخ "Client Secret" وأرسله هنا

يرجى إرسال Client Secret الآن 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendYouTubeSetupStep2(bot, chatId, messageId = null) {
  const message = `⚙️ إعداد قناة يوتيوب - الخطوة 2/3

🆔 يرجى إرسال Client ID الخاص بك.

📝 كيفية الحصول على Client ID:
1. في نفس صفحة Credentials في Google Cloud Console
2. ابحث عن OAuth 2.0 Client ID الذي أنشأته
3. انسخ "Client ID" وأرسله هنا

يرجى إرسال Client ID الآن 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendYouTubeSetupStep3(bot, chatId, messageId = null) {
  const message = `⚙️ إعداد قناة يوتيوب - الخطوة 3/3

🔄 يرجى إرسال Refresh Token الخاص بك.

📝 كيفية الحصول على Refresh Token:
1. استخدم OAuth 2.0 Playground أو أداة مماثلة
2. اختر YouTube Data API v3
3. اختر النطاقات المطلوبة (upload, manage)
4. اكمل عملية المصادقة
5. انسخ "Refresh Token" وأرسله هنا

يرجى إرسال Refresh Token الآن 👇`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    return await bot.sendMessage(chatId, message);
  }
}

export async function sendYouTubeSetupSuccess(bot, chatId, channelTitle, messageId = null) {
  const message = `✅ تم إعداد قناة يوتيوب بنجاح!

📺 القناة: ${channelTitle}

يمكنك الآن نشر الفيديوهات على يوتيوب مباشرة من البوت.`;
  
  if (messageId) {
    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
  } else {
    await bot.sendMessage(chatId, message);
  }
}

