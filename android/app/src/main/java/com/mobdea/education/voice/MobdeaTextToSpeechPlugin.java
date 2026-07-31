package com.mobdea.education.voice;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "MobdeaTextToSpeech")
public class MobdeaTextToSpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private TextToSpeech engine;
    private volatile boolean ready = false;

    @Override
    public void load() {
        super.load();
        getActivity().runOnUiThread(() -> engine = new TextToSpeech(getContext().getApplicationContext(), this));
    }

    @Override
    public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS && engine != null;
        if (ready) {
            int result = engine.setLanguage(new Locale("ar", "EG"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                engine.setLanguage(new Locale("ar"));
            }
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        final String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Speech text is required.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            if (!ready || engine == null) {
                call.reject("Arabic text to speech is not ready. Install or enable an Arabic TTS voice in Android settings.");
                return;
            }

            String language = call.getString("language", "ar-EG");
            String[] localeParts = language.replace('_', '-').split("-", 2);
            Locale locale = localeParts.length > 1 ? new Locale(localeParts[0], localeParts[1]) : new Locale(localeParts[0]);
            int languageResult = engine.setLanguage(locale);
            if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                engine.setLanguage(new Locale("ar", "EG"));
            }

            Double rate = call.getDouble("rate", 0.94d);
            Double pitch = call.getDouble("pitch", 1.0d);
            Double volume = call.getDouble("volume", 1.0d);
            engine.setSpeechRate(Math.max(0.5f, Math.min(1.5f, rate.floatValue())));
            engine.setPitch(Math.max(0.5f, Math.min(1.5f, pitch.floatValue())));

            Bundle parameters = new Bundle();
            parameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume.floatValue())));
            String utteranceId = "mobdea-" + UUID.randomUUID();
            int result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, parameters, utteranceId);
            if (result == TextToSpeech.ERROR) {
                call.reject("Android could not start Arabic speech.");
                return;
            }

            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("utteranceId", utteranceId);
            call.resolve(response);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (engine != null) engine.stop();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (engine != null) {
            engine.stop();
            engine.shutdown();
            engine = null;
        }
        ready = false;
        super.handleOnDestroy();
    }
}
