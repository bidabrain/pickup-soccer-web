package com.pickup.soccer

import android.content.SharedPreferences
import android.os.Bundle
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.PreferenceManager

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = getString(R.string.settings_title)

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.settings_container, NotificationPreferenceFragment())
                .commit()
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == android.R.id.home) { finish(); return true }
        return super.onOptionsItemSelected(item)
    }

    class NotificationPreferenceFragment : PreferenceFragmentCompat(),
        SharedPreferences.OnSharedPreferenceChangeListener {

        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(R.xml.notification_preferences, rootKey)
        }

        override fun onResume() {
            super.onResume()
            PreferenceManager.getDefaultSharedPreferences(requireContext())
                .registerOnSharedPreferenceChangeListener(this)
        }

        override fun onPause() {
            super.onPause()
            PreferenceManager.getDefaultSharedPreferences(requireContext())
                .unregisterOnSharedPreferenceChangeListener(this)
        }

        override fun onSharedPreferenceChanged(prefs: SharedPreferences, key: String?) {
            val ctx = requireContext()
            when (key) {
                PREF_MASTER -> {
                    if (!prefs.getBoolean(PREF_MASTER, true)) {
                        NotificationHelper.unsubscribeFromAll(ctx)
                    } else {
                        NotificationHelper.syncNewMatchTopic(ctx)
                    }
                }
                PREF_NEW_MATCH -> NotificationHelper.syncNewMatchTopic(ctx)
            }
        }
    }

    companion object {
        const val PREF_MASTER = "notifications_enabled"
        const val PREF_NEW_MATCH = "notify_new_match"
        const val PREF_CHANGES = "notify_changes"
        const val PREF_PROMOTION = "notify_promotion"
        const val PREF_PRE_MATCH = "notify_pre_match"
    }
}
