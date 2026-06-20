package com.pickup.soccer

import android.content.Context
import android.webkit.JavascriptInterface
import androidx.preference.PreferenceManager
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

class WebAppInterface(
    private val context: Context,
    private val ui: UiCallbacks? = null,
) {

    /** 网页 → 原生 的界面控制回调（在 binder 线程上触发，实现方需自行切回主线程） */
    interface UiCallbacks {
        fun onRouteChanged(hash: String)
        fun onPullToRefreshChanged(enabled: Boolean)
    }

    // 当前 hash 路由变化时调用（首页 "#/"、新建 "#/create"、详情 "#/match/:id"）
    @JavascriptInterface
    fun onRouteChanged(hash: String) {
        ui?.onRouteChanged(hash)
    }

    // 网页根据当前页面/弹窗状态控制下拉刷新是否可用（报名、新建预约时为 false）
    @JavascriptInterface
    fun setPullToRefresh(enabled: Boolean) {
        ui?.onPullToRefreshChanged(enabled)
    }

    // 当网页检测到「GET /api/matches/:id」成功时调用，用于缓存 start_utc
    @JavascriptInterface
    fun onMatchDetail(matchId: String, startUtcStr: String, maxPlayers: Int) {
        val startUtc = startUtcStr.toLongOrNull() ?: return
        NotificationHelper.storeMatchStartUtc(context, matchId, startUtc)
    }

    // 当网页检测到「POST /api/matches/:id/registrations」成功时调用
    @JavascriptInterface
    fun onRegistered(matchId: String, position: Int) {
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        val masterOn = prefs.getBoolean(SettingsActivity.PREF_MASTER, true)
        if (!masterOn) return

        // 订阅该场更新通知
        NotificationHelper.subscribeToMatch(context, matchId)

        // 调度开赛前 2 小时本地提醒
        if (prefs.getBoolean(SettingsActivity.PREF_PRE_MATCH, true)) {
            schedulePreMatchReminder(matchId)
        }
    }

    private fun schedulePreMatchReminder(matchId: String) {
        val startUtc = NotificationHelper.getMatchStartUtc(context, matchId)
        if (startUtc < 0) return

        val delay = startUtc - System.currentTimeMillis() - 2 * 60 * 60 * 1000L
        if (delay <= 0) return

        val request = OneTimeWorkRequestBuilder<PreMatchReminderWorker>()
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .setInputData(workDataOf(PreMatchReminderWorker.KEY_MATCH_ID to matchId))
            .addTag("prematch_$matchId")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "prematch_$matchId",
            ExistingWorkPolicy.REPLACE,
            request
        )
    }
}
