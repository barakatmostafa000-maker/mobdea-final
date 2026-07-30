package com.mobdea.education;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mobdea.education.security.MobdeaSecureStorePlugin;
import com.mobdea.education.pdf.MobdeaPdfRendererPlugin;
import com.mobdea.education.update.MobdeaUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MobdeaSecureStorePlugin.class);
        registerPlugin(MobdeaPdfRendererPlugin.class);
        registerPlugin(MobdeaUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
