package com.mobdea.education;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.graphics.Color;

import java.util.Locale;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.mobdea.education.security.MobdeaSecureStorePlugin;
import com.mobdea.education.pdf.MobdeaPdfRendererPlugin;
import com.mobdea.education.ocr.MobdeaPdfOcrPlugin;
import com.mobdea.education.pptx.MobdeaPptxRendererPlugin;
import com.mobdea.education.update.MobdeaUpdaterPlugin;
import com.mobdea.education.voice.MobdeaTextToSpeechPlugin;
import com.mobdea.education.document.MobdeaDocumentViewerPlugin;
import com.mobdea.education.printing.MobdeaPrintPlugin;
import com.mobdea.education.recording.MobdeaScreenRecorderPlugin;
import com.mobdea.education.assets.MobdeaNativeAssetPlugin;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "mobdea_native_boot";
    private static final String PREF_VERSION = "web_assets_version";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MobdeaSecureStorePlugin.class);
        registerPlugin(MobdeaPdfRendererPlugin.class);
        registerPlugin(MobdeaPdfOcrPlugin.class);
        registerPlugin(MobdeaPptxRendererPlugin.class);
        registerPlugin(MobdeaUpdaterPlugin.class);
        registerPlugin(MobdeaTextToSpeechPlugin.class);
        registerPlugin(MobdeaDocumentViewerPlugin.class);
        registerPlugin(MobdeaPrintPlugin.class);
        registerPlugin(MobdeaScreenRecorderPlugin.class);
        registerPlugin(MobdeaNativeAssetPlugin.class);
        super.onCreate(savedInstanceState);

        configureSystemBarInsets();
        clearStaleWebCacheAfterUpgrade();
    }

    private void configureSystemBarInsets() {
        try {
            // Android 15 enforces edge-to-edge for targetSdk 35. Keep the WebView
            // aware of status/navigation/cutout insets so controls never sit under
            // the system bars on phones or tablets.
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);

            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(
                    getWindow(),
                    getWindow().getDecorView()
            );
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);

            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) return;

            ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars()
                                | WindowInsetsCompat.Type.displayCutout()
                );
                float density = Math.max(1f, getResources().getDisplayMetrics().density);
                int left = Math.round(insets.left / density);
                int top = Math.round(insets.top / density);
                int right = Math.round(insets.right / density);
                int bottom = Math.round(insets.bottom / density);
                String script = String.format(
                        Locale.US,
                        "document.documentElement.style.setProperty('--mobdea-native-inset-left','%dpx');"
                                + "document.documentElement.style.setProperty('--mobdea-native-inset-top','%dpx');"
                                + "document.documentElement.style.setProperty('--mobdea-native-inset-right','%dpx');"
                                + "document.documentElement.style.setProperty('--mobdea-native-inset-bottom','%dpx');",
                        left,
                        top,
                        right,
                        bottom
                );
                Runnable publishInsets = () -> webView.evaluateJavascript(script, null);
                webView.post(publishInsets);
                // The first launch after an APK upgrade reloads the WebView once
                // after clearing stale assets. Re-publish the insets after that
                // reload so the status-bar offset cannot be lost.
                webView.postDelayed(publishInsets, 350L);
                webView.postDelayed(publishInsets, 1200L);
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(webView);
        } catch (Exception ignored) {
            // CSS safe-area fallbacks still keep the interface usable.
        }
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
