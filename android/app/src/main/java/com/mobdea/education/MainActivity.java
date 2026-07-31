package com.mobdea.education;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mobdea.education.security.MobdeaSecureStorePlugin;
import com.mobdea.education.pdf.MobdeaPdfRendererPlugin;
import com.mobdea.education.update.MobdeaUpdaterPlugin;
import com.mobdea.education.voice.MobdeaTextToSpeechPlugin;
import com.mobdea.education.document.MobdeaDocumentViewerPlugin;
import com.mobdea.education.printing.MobdeaPrintPlugin;
import com.mobdea.education.recording.MobdeaScreenRecorderPlugin;

public class MainActivity extends BridgeActivity {
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
    }
}
