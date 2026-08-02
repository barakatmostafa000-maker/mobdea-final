package com.mobdea.education.recording;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Environment;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.mobdea.education.MainActivity;
import com.mobdea.education.R;

import java.io.File;
import java.io.IOException;

public class MobdeaScreenRecorderService extends Service {
    public static final String ACTION_START = "com.mobdea.education.recording.START";
    public static final String ACTION_STOP = "com.mobdea.education.recording.STOP";
    public static final String ACTION_PAUSE = "com.mobdea.education.recording.PAUSE";
    public static final String ACTION_RESUME = "com.mobdea.education.recording.RESUME";
    public static final String ACTION_RESULT = "com.mobdea.education.recording.RESULT";

    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    public static final String EXTRA_WITH_AUDIO = "withAudio";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_PATH = "path";
    public static final String EXTRA_FILE_NAME = "fileName";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_ERROR = "error";

    private static final String CHANNEL_ID = "mobdea_screen_recording";
    private static final int NOTIFICATION_ID = 2047;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private MediaRecorder mediaRecorder;
    private File outputFile;
    private long startedAt;
    private boolean recording;
    private boolean stopping;
    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override
        public void onStop() {
            if (stopping) return;
            mediaProjection = null;
            stopRecording(true, "تم إيقاف مشاركة الشاشة من النظام.");
        }
    };

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) return START_NOT_STICKY;
        switch (intent.getAction()) {
            case ACTION_START:
                startForeground(NOTIFICATION_ID, buildNotification("جارٍ تسجيل الحصة"));
                startRecording(intent);
                break;
            case ACTION_PAUSE:
                pauseRecording();
                break;
            case ACTION_RESUME:
                resumeRecording();
                break;
            case ACTION_STOP:
                stopRecording(true, "");
                break;
            default:
                break;
        }
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, pendingFlags);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("منصة المُبدع")
            .setContentText(text)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "تسجيل الحصة",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("إشعار مستمر أثناء تسجيل شاشة الحصة وصوت المعلم.");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void startRecording(Intent intent) {
        if (recording) return;
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED);
        Intent resultData = getResultData(intent);
        if (resultCode != Activity.RESULT_OK || resultData == null) {
            stopRecording(false, "لم يتم منح إذن تسجيل الشاشة.");
            return;
        }

        try {
            MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (manager == null) throw new IllegalStateException("خدمة تسجيل الشاشة غير متاحة.");
            mediaProjection = manager.getMediaProjection(resultCode, resultData);
            if (mediaProjection == null) throw new IllegalStateException("تعذر بدء التقاط الشاشة.");
            mediaProjection.registerCallback(projectionCallback, new Handler(Looper.getMainLooper()));

            boolean withAudio = intent.getBooleanExtra(EXTRA_WITH_AUDIO, true);
            outputFile = createOutputFile(intent.getStringExtra(EXTRA_TITLE));
            mediaRecorder = createRecorder(outputFile, withAudio);

            DisplayMetrics metrics = getResources().getDisplayMetrics();
            int width = makeEven(Math.min(Math.max(metrics.widthPixels, metrics.heightPixels), 1920));
            int height = makeEven(Math.min(Math.min(metrics.widthPixels, metrics.heightPixels), 1080));
            int density = metrics.densityDpi;

            virtualDisplay = mediaProjection.createVirtualDisplay(
                "MobdeaClassRecording",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder.getSurface(),
                null,
                null
            );
            mediaRecorder.start();
            startedAt = System.currentTimeMillis();
            recording = true;
        } catch (Exception error) {
            stopRecording(false, safeError(error, "تعذر تشغيل تسجيل الشاشة."));
        }
    }

    @SuppressWarnings("deprecation")
    private Intent getResultData(Intent source) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return source.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        }
        return source.getParcelableExtra(EXTRA_RESULT_DATA);
    }

    private MediaRecorder createRecorder(File file, boolean withAudio) throws IOException {
        MediaRecorder recorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            ? new MediaRecorder(this)
            : new MediaRecorder();
        if (withAudio) recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        recorder.setVideoEncodingBitRate(5_000_000);
        recorder.setVideoFrameRate(24);

        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int width = makeEven(Math.min(Math.max(metrics.widthPixels, metrics.heightPixels), 1920));
        int height = makeEven(Math.min(Math.min(metrics.widthPixels, metrics.heightPixels), 1080));
        recorder.setVideoSize(width, height);

        if (withAudio) {
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(128_000);
            recorder.setAudioSamplingRate(44_100);
        }
        recorder.setOutputFile(file.getAbsolutePath());
        recorder.prepare();
        return recorder;
    }

    private File createOutputFile(String title) throws IOException {
        File moviesDirectory = getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        if (moviesDirectory == null) moviesDirectory = new File(getFilesDir(), "movies");
        File directory = new File(moviesDirectory, "lesson-recordings");
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("تعذر إنشاء مجلد التسجيلات.");
        String safeTitle = String.valueOf(title == null ? "الحصة" : title)
            .replaceAll("[^\\p{L}\\p{N}._-]+", "-")
            .replaceAll("-+", "-");
        if (safeTitle.length() > 60) safeTitle = safeTitle.substring(0, 60);
        return new File(directory, "mobdea-" + safeTitle + "-" + System.currentTimeMillis() + ".mp4");
    }

    private int makeEven(int value) {
        int safe = Math.max(2, value);
        return safe % 2 == 0 ? safe : safe - 1;
    }

    private void pauseRecording() {
        if (!recording || mediaRecorder == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            mediaRecorder.pause();
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification("تسجيل الحصة متوقف مؤقتًا"));
        } catch (RuntimeException ignored) {
            // Keep the active recording if the device does not support pause reliably.
        }
    }

    private void resumeRecording() {
        if (!recording || mediaRecorder == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            mediaRecorder.resume();
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification("جارٍ تسجيل الحصة"));
        } catch (RuntimeException ignored) {
            // Keep the active recording if the device does not support resume reliably.
        }
    }

    private void stopRecording(boolean notifyResult, String errorMessage) {
        if (stopping) return;
        stopping = true;
        long durationMs = startedAt > 0 ? Math.max(0, System.currentTimeMillis() - startedAt) : 0;
        String finalError = errorMessage == null ? "" : errorMessage;
        if (mediaRecorder != null) {
            try {
                if (recording) mediaRecorder.stop();
            } catch (RuntimeException error) {
                if (finalError.isEmpty()) finalError = "تعذر إنهاء ملف التسجيل بصورة سليمة.";
                if (outputFile != null) outputFile.delete();
            }
            try { mediaRecorder.reset(); } catch (RuntimeException ignored) {}
            mediaRecorder.release();
            mediaRecorder = null;
        }
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        MediaProjection activeProjection = mediaProjection;
        mediaProjection = null;
        if (activeProjection != null) {
            try { activeProjection.unregisterCallback(projectionCallback); } catch (RuntimeException ignored) {}
            try { activeProjection.stop(); } catch (RuntimeException ignored) {}
        }
        recording = false;
        startedAt = 0;

        if (notifyResult || !finalError.isEmpty()) sendResult(durationMs, finalError);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
    }

    private void sendResult(long durationMs, String error) {
        Intent result = new Intent(ACTION_RESULT);
        result.setPackage(getPackageName());
        result.putExtra(EXTRA_DURATION_MS, durationMs);
        result.putExtra(EXTRA_ERROR, error == null ? "" : error);
        if (outputFile != null && outputFile.exists()) {
            result.putExtra(EXTRA_PATH, outputFile.getAbsolutePath());
            result.putExtra(EXTRA_FILE_NAME, outputFile.getName());
        }
        sendBroadcast(result);
    }

    private String safeError(Exception error, String fallback) {
        String message = error == null ? "" : error.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }

    @Override
    public void onDestroy() {
        if (recording || mediaRecorder != null || mediaProjection != null) {
            stopRecording(false, "تم إيقاف التسجيل بسبب إغلاق الخدمة.");
        }
        super.onDestroy();
    }
}
