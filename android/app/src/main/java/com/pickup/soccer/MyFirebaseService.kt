package com.pickup.soccer

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.preference.PreferenceManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseService : FirebaseMessagingService() {

    override fun onMessageReceived(msg: RemoteMessage) {
        val prefs = PreferenceManager.getDefaultSharedPreferences(this)
        if (!prefs.getBoolean(SettingsActivity.PREF_MASTER, true)) return

        val data = msg.data
        val type = data["type"] ?: "unknown"
        val matchId = data["matchId"]
        val title = msg.notification?.title ?: data["title"] ?: "Pickup Football"
        val body = msg.notification?.body ?: data["body"] ?: ""

        // 按 type 过滤，只在对应开关打开时显示
        val shouldShow = when (type) {
            "new_match" -> prefs.getBoolean(SettingsActivity.PREF_NEW_MATCH, true)
            "change", "cancel" -> prefs.getBoolean(SettingsActivity.PREF_CHANGES, true)
            "promotion" -> prefs.getBoolean(SettingsActivity.PREF_PROMOTION, true)
            else -> true
        }
        if (!shouldShow) return

        val channel = when (type) {
            "new_match" -> NotificationHelper.CHANNEL_NEW_MATCH
            else -> NotificationHelper.CHANNEL_MATCH_UPDATES
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            if (matchId != null) putExtra("matchId", matchId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            this,
            (type + matchId).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        NotificationManagerCompat.from(this)
            .notify((type + matchId).hashCode(), notification)
    }

    // FCM token 刷新时重新同步 topic 订阅
    override fun onNewToken(token: String) {
        NotificationHelper.syncNewMatchTopic(this)
    }
}
