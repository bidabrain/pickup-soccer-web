package com.pickup.soccer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.content.getSystemService
import com.google.firebase.messaging.FirebaseMessaging

object NotificationHelper {

    const val CHANNEL_NEW_MATCH = "ch_new_match"
    const val CHANNEL_MATCH_UPDATES = "ch_match_updates"
    const val CHANNEL_PRE_MATCH = "ch_pre_match"

    const val TOPIC_NEW_MATCHES = "pickup_new_matches"
    fun matchTopic(matchId: String) = "pickup_match_$matchId"

    private const val PREFS_SUBSCRIPTIONS = "subscriptions"
    private const val KEY_MATCH_IDS = "match_ids"
    private const val KEY_START_UTC_PREFIX = "start_utc_"

    fun createChannels(context: Context) {
        val nm = context.getSystemService<NotificationManager>() ?: return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_NEW_MATCH, "新预约场次", NotificationManager.IMPORTANCE_DEFAULT)
                .apply { description = "有新的约球场次发布时通知" }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MATCH_UPDATES, "场次更新", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "已报名场次信息变动或候补转正通知" }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_PRE_MATCH, "开赛提醒", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "比赛开始前 2 小时提醒" }
        )
    }

    // 根据当前通知开关，订阅或取消订阅「新场次」FCM topic
    fun syncNewMatchTopic(context: Context) {
        val prefs = androidx.preference.PreferenceManager.getDefaultSharedPreferences(context)
        val masterOn = prefs.getBoolean(SettingsActivity.PREF_MASTER, true)
        val newMatchOn = prefs.getBoolean(SettingsActivity.PREF_NEW_MATCH, true)
        if (masterOn && newMatchOn) {
            FirebaseMessaging.getInstance().subscribeToTopic(TOPIC_NEW_MATCHES)
        } else {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(TOPIC_NEW_MATCHES)
        }
    }

    // 报名成功后，订阅该场的 FCM topic，并存储 matchId
    fun subscribeToMatch(context: Context, matchId: String) {
        val prefs = androidx.preference.PreferenceManager.getDefaultSharedPreferences(context)
        val masterOn = prefs.getBoolean(SettingsActivity.PREF_MASTER, true)
        val changesOn = prefs.getBoolean(SettingsActivity.PREF_CHANGES, true)
        val promotionOn = prefs.getBoolean(SettingsActivity.PREF_PROMOTION, true)
        if (!masterOn || (!changesOn && !promotionOn)) return

        FirebaseMessaging.getInstance().subscribeToTopic(matchTopic(matchId))
        addSubscribedMatchId(context, matchId)
    }

    // 关闭总开关时，取消所有已订阅的场次 topic
    fun unsubscribeFromAll(context: Context) {
        FirebaseMessaging.getInstance().unsubscribeFromTopic(TOPIC_NEW_MATCHES)
        val matchIds = getSubscribedMatchIds(context)
        for (id in matchIds) {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(matchTopic(id))
        }
    }

    // 存储该场的 start_utc，供 WorkManager 调度开赛提醒
    fun storeMatchStartUtc(context: Context, matchId: String, startUtc: Long) {
        context.getSharedPreferences(PREFS_SUBSCRIPTIONS, Context.MODE_PRIVATE)
            .edit().putLong(KEY_START_UTC_PREFIX + matchId, startUtc).apply()
    }

    fun getMatchStartUtc(context: Context, matchId: String): Long {
        return context.getSharedPreferences(PREFS_SUBSCRIPTIONS, Context.MODE_PRIVATE)
            .getLong(KEY_START_UTC_PREFIX + matchId, -1L)
    }

    private fun addSubscribedMatchId(context: Context, matchId: String) {
        val sp = context.getSharedPreferences(PREFS_SUBSCRIPTIONS, Context.MODE_PRIVATE)
        val ids = sp.getStringSet(KEY_MATCH_IDS, emptySet())!!.toMutableSet()
        ids.add(matchId)
        sp.edit().putStringSet(KEY_MATCH_IDS, ids).apply()
    }

    fun getSubscribedMatchIds(context: Context): Set<String> {
        return context.getSharedPreferences(PREFS_SUBSCRIPTIONS, Context.MODE_PRIVATE)
            .getStringSet(KEY_MATCH_IDS, emptySet()) ?: emptySet()
    }
}
