package com.mobdea.education.recording;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.projection.MediaProjectionManager;
import android.os.Build;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "MobdeaScreenRecorder",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class MobdeaScreenRecorderPlugin extends Plugin {
    private PluginCall pendingStopCall;
    private boolean active;
    private boolean receiverRegistered;

    private final BroadcastReceiver resultReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!MobdeaScreenRecorderService.ACTION_RESULT.equals(intent.getAction())) return;
            active = false;
            PluginCall call = pendingStopCall;
            pendingStopCall = null;
            if (call == null) return;
            String error = intent.getStringExtra(MobdeaScreenRecorderService.EXTRA_ERROR);
            if (error != null && !error.trim().isEmpty()) {
                call.reject(error);
                return;
            }
            String path = intent.getStringExtra(MobdeaScreenRecorderService.EXTRA_PATH);
            if (path == null || path.trim().isEmpty()) {
                call.reject("لم يتم إنشاء ملف تسجيل صالح.");
                return;
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("path", path);
            result.put("fileName", intent.getStringExtra(MobdeaScreenRecorderService.EXTRA_FILE_NAME));
            result.put("mimeType", "video/mp4");
            result.put("durationMs", intent.getLongExtra(MobdeaScreenRecorderService.EXTRA_DURATION_MS, 0));
            call.resolve(result);
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter(MobdeaScreenRecorderService.ACTION_RESULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(resultReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(resultReceiver, filter);
        }
        receiverRegistered = true;
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (active) {
            call.reject("يوجد تسجيل حصة يعمل بالفعل.");
            return;
        }
        boolean withAudio = call.getBoolean("withAudio", true);
        if (withAudio && getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionResult");
            return;
        }
        launchCaptureConsent(call);
    }

    @PermissionCallback
    private void microphonePermissionResult(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("لم يتم منح إذن الميكروفون لتسجيل صوت المعلم.");
            return;
        }
        launchCaptureConsent(call);
    }

    private void launchCaptureConsent(PluginCall call) {
        MediaProjectionManager manager = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            call.reject("خدمة تسجيل الشاشة غير متاحة على هذا الجهاز.");
            return;
        }
        startActivityForResult(call, manager.createScreenCaptureIntent(), "capturePermissionResult");
    }

    @ActivityCallback
    private void capturePermissionResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("تم إلغاء إذن تسجيل الشاشة.");
            return;
        }
        Intent serviceIntent = new Intent(getContext(), MobdeaScreenRecorderService.class);
        serviceIntent.setAction(MobdeaScreenRecorderService.ACTION_START);
        serviceIntent.putExtra(MobdeaScreenRecorderService.EXTRA_RESULT_CODE, result.getResultCode());
        serviceIntent.putExtra(MobdeaScreenRecorderService.EXTRA_RESULT_DATA, result.getData());
        serviceIntent.putExtra(MobdeaScreenRecorderService.EXTRA_WITH_AUDIO, call.getBoolean("withAudio", true));
        serviceIntent.putExtra(MobdeaScreenRecorderService.EXTRA_TITLE, call.getString("title", "الحصة"));
        try {
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            active = true;
            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("active", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("تعذر بدء خدمة تسجيل الشاشة.", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (!active) {
            call.reject("لا يوجد تسجيل نشط لإيقافه.");
            return;
        }
        if (pendingStopCall != null) {
            call.reject("جارٍ حفظ التسجيل الحالي بالفعل.");
            return;
        }
        pendingStopCall = call;
        Intent intent = new Intent(getContext(), MobdeaScreenRecorderService.class);
        intent.setAction(MobdeaScreenRecorderService.ACTION_STOP);
        getContext().startService(intent);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        sendControl(MobdeaScreenRecorderService.ACTION_PAUSE);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        sendControl(MobdeaScreenRecorderService.ACTION_RESUME);
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", active);
        call.resolve(result);
    }

    private void sendControl(String action) {
        Intent intent = new Intent(getContext(), MobdeaScreenRecorderService.class);
        intent.setAction(action);
        getContext().startService(intent);
    }

    @Override
    protected void handleOnDestroy() {
        if (receiverRegistered) {
            try { getContext().unregisterReceiver(resultReceiver); } catch (IllegalArgumentException ignored) {}
            receiverRegistered = false;
        }
        if (pendingStopCall != null) {
            pendingStopCall.reject("تم إغلاق شاشة الحصة قبل اكتمال حفظ التسجيل.");
            pendingStopCall = null;
        }
        super.handleOnDestroy();
    }
}
