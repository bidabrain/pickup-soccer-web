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
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity(), WebAppInterface.UiCallbacks {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private var lastResumeLoadTime = 0L
    private var lastBackPressTime = 0L

    // 网页当前 hash 路由（binder 线程写、主线程读）
    @Volatile private var currentHash = ""

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* 权限结果静默处理，用户拒绝则通知功能降级 */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setSupportActionBar(findViewById<Toolbar>(R.id.toolbar))
        supportActionBar?.setDisplayShowTitleEnabled(false)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        swipeRefresh.setColorSchemeResources(R.color.brand_green)
        swipeRefresh.setOnRefreshListener { webView.reload() }
        setupWebView()

        NotificationHelper.createChannels(this)
        NotificationHelper.syncNewMatchTopic(this)
        requestNotificationPermissionIfNeeded()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val atHome = currentHash.isEmpty() || currentHash == "#" || currentHash == "#/"
                if (!atHome) {
                    // 子页面（新建预约 / 场次详情）：回退到首页
                    if (webView.canGoBack()) webView.goBack()
                    else webView.evaluateJavascript("window.location.hash = '#/'", null)
                } else {
                    // 首页：两次返回手势内彻底关闭应用
                    val now = System.currentTimeMillis()
                    if (now - lastBackPressTime < 2000) {
                        finishAndRemoveTask()
                    } else {
                        lastBackPressTime = now
                        Toast.makeText(this@MainActivity, R.string.exit_confirm, Toast.LENGTH_SHORT).show()
                    }
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

        webView.addJavascriptInterface(WebAppInterface(this, this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = false

            override fun onPageFinished(view: WebView, url: String) {
                view.evaluateJavascript(JS_BRIDGE, null)
                swipeRefresh.isRefreshing = false
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

    // —— WebAppInterface.UiCallbacks（在 binder 线程触发，需切回主线程操作 UI）——

    override fun onRouteChanged(hash: String) {
        currentHash = hash
        // 默认：除「新建预约」外都允许下拉刷新；详情页报名弹窗会再单独关闭
        val enabled = !hash.startsWith("#/create")
        runOnUiThread { swipeRefresh.isEnabled = enabled }
    }

    override fun onPullToRefreshChanged(enabled: Boolean) {
        runOnUiThread { swipeRefresh.isEnabled = enabled }
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

  // 路由变化上报：原生据此决定回退行为与下拉刷新是否可用
  function reportRoute() {
    try {
      if (window.AndroidBridge && AndroidBridge.onRouteChanged)
        AndroidBridge.onRouteChanged(window.location.hash || '');
    } catch (e) {}
  }
  window.addEventListener('hashchange', reportRoute);
  reportRoute();

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
