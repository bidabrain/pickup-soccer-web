package com.pickup.soccer

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var lastResumeLoadTime = 0L

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* 权限结果静默处理，用户拒绝则通知功能降级 */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setSupportActionBar(findViewById<Toolbar>(R.id.toolbar))
        supportActionBar?.setDisplayShowTitleEnabled(false)

        webView = findViewById(R.id.webView)
        setupWebView()

        NotificationHelper.createChannels(this)
        NotificationHelper.syncNewMatchTopic(this)
        requestNotificationPermissionIfNeeded()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        handleDeepLink(intent)
    }

    override fun onResume() {
        super.onResume()
        // 后台超过 30 秒回来才重载，避免切个输入法也刷新
        val now = System.currentTimeMillis()
        if (now - lastResumeLoadTime > 30_000) {
            webView.reload()
            lastResumeLoadTime = now
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent) {
        val matchId = intent.getStringExtra("matchId")
            ?: intent.data?.lastPathSegment
        if (matchId != null) {
            // 等 WebView 加载完成再跳转（bridge 安装后才能接受导航）
            webView.post { webView.loadUrl("$BASE_URL#/match/$matchId") }
        }
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setSupportZoom(false)
            builtInZoomControls = false
        }

        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = false

            override fun onPageFinished(view: WebView, url: String) {
                view.evaluateJavascript(JS_BRIDGE, null)
            }
        }

        webView.webChromeClient = WebChromeClient()
        webView.loadUrl(BASE_URL)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == R.id.action_settings) {
            startActivity(Intent(this, SettingsActivity::class.java))
            return true
        }
        return super.onOptionsItemSelected(item)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    companion object {
        const val BASE_URL = "https://bidabrain.github.io/pickup-soccer-web/"

        // 注入到 WebView 的 JS bridge：拦截 fetch 检测报名和场次详情加载
        // $ 在 Kotlin 字符串模板中需转义为 ${'$'}
        val JS_BRIDGE = """
(function() {
  if (window._pickupBridgeInstalled) return;
  window._pickupBridgeInstalled = true;
  const _orig = window.fetch;
  window.fetch = async function() {
    const res = await _orig.apply(this, arguments);
    try {
      var url = typeof arguments[0] === 'string' ? arguments[0]
                : (arguments[0] && arguments[0].url) || '';
      var method = ((arguments[1] && arguments[1].method) || 'GET').toUpperCase();
      var path = url.split('?')[0];
      if (res.ok) {
        var regM = path.match(/\/api\/matches\/([^\/]+)\/registrations${'$'}/);
        if (method === 'POST' && regM) {
          res.clone().json().then(function(d) {
            if (window.AndroidBridge)
              AndroidBridge.onRegistered(regM[1], d.position || 0);
          }).catch(function(){});
        }
        var detM = path.match(/\/api\/matches\/([^\/]+)${'$'}/);
        if (method === 'GET' && detM) {
          res.clone().json().then(function(d) {
            if (window.AndroidBridge && d.start_utc)
              AndroidBridge.onMatchDetail(detM[1], String(d.start_utc), d.max_players || 0);
          }).catch(function(){});
        }
      }
    } catch(e) {}
    return res;
  };
})();
""".trimIndent()
    }
}
