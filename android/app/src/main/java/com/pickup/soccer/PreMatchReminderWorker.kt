package com.pickup.soccer

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.preference.PreferenceManager
import androidx.work.Worker
import androidx.work.WorkerParameters

class PreMatchReminderWorker(
    private val context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        val matchId = inputData.getString(KEY_MATCH_ID) ?: return Result.success()

        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        if (!prefs.getBoolean(SettingsActivity.PREF_MASTER, true)) return Result.success()
        if (!prefs.getBoolean(SettingsActivity.PREF_PRE_MATCH, true)) return Result.success()

        val intent = Intent(context, MainActivity::class.java).apply {
            putExtra("matchId", matchId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context, matchId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, NotificationHelper.CHANNEL_PRE_MATCH)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("⚽ 开赛提醒")
            .setContentText("你报名的场次将在 2 小时后开始，别忘了！")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        NotificationManagerCompat.from(context)
            .notify(matchId.hashCode(), notification)

        return Result.success()
    }

    companion object {
        const val KEY_MATCH_ID = "matchId"
    }
}
