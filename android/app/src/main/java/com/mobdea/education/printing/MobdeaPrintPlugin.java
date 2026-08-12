package com.mobdea.education.printing;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.os.Build;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MobdeaPrint")
public class MobdeaPrintPlugin extends Plugin {
    @PluginMethod
    public void printCurrentView(PluginCall call) {
        final String title = call.getString("title", "بطاقات طلاب المبدع");
        if (getActivity() == null) {
            call.reject("شاشة الطباعة غير متاحة الآن.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null || webView == null) {
                    call.reject("خدمة الطباعة غير متاحة على هذا الجهاز.");
                    return;
                }
                final String duplexMode = call.getString("duplexMode", "none");
                PrintAttributes.Builder attributesBuilder = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if ("driver-long-edge".equals(duplexMode)) {
                        attributesBuilder.setDuplexMode(PrintAttributes.DUPLEX_MODE_LONG_EDGE);
                    } else if ("driver-short-edge".equals(duplexMode)) {
                        attributesBuilder.setDuplexMode(PrintAttributes.DUPLEX_MODE_SHORT_EDGE);
                    } else {
                        attributesBuilder.setDuplexMode(PrintAttributes.DUPLEX_MODE_NONE);
                    }
                }

                final PrintAttributes attributes = attributesBuilder.build();
                final Runnable launchPrint = () -> {
                    try {
                        printManager.print(title, webView.createPrintDocumentAdapter(title), attributes);
                        JSObject result = new JSObject();
                        result.put("ok", true);
                        call.resolve(result);
                    } catch (Exception printError) {
                        call.reject("تعذر تشغيل معاينة الطباعة.", printError);
                    }
                };

                // Android's print adapter can capture a blank/stale frame when it
                // is created immediately after React swaps to the printable DOM.
                // Wait until the WebView confirms the current visual state is
                // committed, then create the adapter from that exact frame.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    webView.postVisualStateCallback(System.nanoTime(), new WebView.VisualStateCallback() {
                        @Override
                        public void onComplete(long requestId) {
                            webView.postDelayed(launchPrint, 120L);
                        }
                    });
                } else {
                    webView.postDelayed(launchPrint, 500L);
                }
            } catch (Exception error) {
                call.reject("تعذر تشغيل معاينة الطباعة.", error);
            }
        });
    }
}
