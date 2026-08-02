package com.mobdea.education;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.mobdea.education.security.MobdeaSecureStorePlugin;
import com.mobdea.education.pdf.MobdeaPdfRendererPlugin;
import com.mobdea.education.update.MobdeaUpdaterPlugin;
import com.mobdea.education.voice.MobdeaTextToSpeechPlugin;
import com.mobdea.education.document.MobdeaDocumentViewerPlugin;
import com.mobdea.education.printing.MobdeaPrintPlugin;
import com.mobdea.education.recording.MobdeaScreenRecorderPlugin;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "mobdea_native_boot";
    private static final String PREF_VERSION = "web_assets_version";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MobdeaSecureStorePlugin.class);
        registerPlugin(MobdeaPdfRendererPlugin.class);
        registerPlugin(MobdeaUpdaterPlugin.class);
        registerPlugin(MobdeaTextToSpeechPlugin.class);
        registerPlugin(MobdeaDocumentViewerPlugin.class);
        registerPlugin(MobdeaPrintPlugin.class);
        registerPlugin(MobdeaScreenRecorderPlugin.class);
        super.onCreate(savedInstanceState);

        clearStaleWebCacheAfterUpgrade();
    }

    private long currentVersionCode() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return info.getLongVersionCode();
            }
            return info.versionCode;
        } catch (Exception ignored) {
            return -1L;
        }
    }

    private void clearStaleWebCacheAfterUpgrade() {
        final long currentVersion = currentVersionCode();
        if (currentVersion < 0) return;

        SharedPreferences preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        long previousVersion = preferences.getLong(PREF_VERSION, -1L);
        if (previousVersion == currentVersion) return;

        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                // Keeps IndexedDB/local app data intact while removing stale HTML,
                // JavaScript and CSS files that caused the tablet white screen.
                webView.clearCache(true);
                webView.clearHistory();
                webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
                // BridgeActivity may have started loading before the upgrade was
                // detected. Reload once after clearing so the first visible page
                // definitely uses the APK assets from the new version.
                webView.postDelayed(webView::reload, 120L);
                webView.postDelayed(() -> webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT), 6000L);
            }
        } catch (Exception ignored) {
            // Startup must continue even when a vendor WebView rejects cache APIs.
        }

        preferences.edit().putLong(PREF_VERSION, currentVersion).apply();
    }
}
