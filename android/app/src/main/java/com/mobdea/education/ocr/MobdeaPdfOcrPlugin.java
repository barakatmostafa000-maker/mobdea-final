package com.mobdea.education.ocr;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.googlecode.tesseract.android.TessBaseAPI;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.GZIPInputStream;

@CapacitorPlugin(name = "MobdeaPdfOcr")
public class MobdeaPdfOcrPlugin extends Plugin {
    private static final String TAG = "MobdeaPdfOcr";
    private static final long MAX_PDF_BYTES = 200L * 1024L * 1024L;
    private static final int MAX_PAGE_RANGE = 20;
    private static final int MAX_RENDER_WIDTH = 1600;
    private static final int MAX_RENDER_HEIGHT = 2500;
    private static final String ARA_MODEL_URL = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/ara.traineddata";
    private static final String ENG_MODEL_URL = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata";
    private final ConcurrentHashMap<String, AtomicBoolean> cancellations = new ConcurrentHashMap<>();

    @PluginMethod
    public void recognizePdfPages(PluginCall call) {
        final String assetPath = call.getString("assetPath", "");
        final String taskId = call.getString("taskId", "");
        final int requestedStart = Math.max(1, call.getInt("startPage", 1));
        final int requestedEnd = Math.max(requestedStart, call.getInt("endPage", requestedStart));
        final int requestedWidth = Math.min(MAX_RENDER_WIDTH, Math.max(1000, call.getInt("maxWidth", 1600)));
        final String language = sanitizeLanguage(call.getString("language", "ara+eng"));

        if (assetPath.isEmpty() || taskId.isEmpty()) {
            call.reject("A staged PDF path and OCR task id are required.");
            return;
        }
        if (requestedEnd - requestedStart + 1 > MAX_PAGE_RANGE) {
            call.reject("The OCR page range is too large.");
            return;
        }

        AtomicBoolean cancelled = new AtomicBoolean(false);
        cancellations.put(taskId, cancelled);
        new Thread(() -> runOcr(call, assetPath, taskId, cancelled, requestedStart, requestedEnd, requestedWidth, language)).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String taskId = call.getString("taskId", "");
        AtomicBoolean cancelled = cancellations.get(taskId);
        if (cancelled != null) cancelled.set(true);
        JSObject result = new JSObject();
        result.put("cancelled", cancelled != null);
        call.resolve(result);
    }

    private void runOcr(PluginCall call, String assetPath, String taskId, AtomicBoolean cancelled, int requestedStart, int requestedEnd, int requestedWidth, String language) {
        File pdfFile = null;
        ParcelFileDescriptor descriptor = null;
        PdfRenderer renderer = null;
        TessBaseAPI tess = null;
        boolean modelDownloaded = false;

        try {
            Log.i(TAG, "OCR start task=" + taskId + " pages=" + requestedStart + "-" + requestedEnd + " width=" + requestedWidth + " language=" + language);
            pdfFile = resolveStagedAsset(assetPath);
            if (!pdfFile.exists() || pdfFile.length() == 0 || pdfFile.length() > MAX_PDF_BYTES) {
                throw new IllegalArgumentException("PDF size is not supported.");
            }
            checkCancelled(cancelled);

            File dataRoot = new File(getContext().getFilesDir(), "mobdea-ocr");
            File tessdata = new File(dataRoot, "tessdata");
            if (!tessdata.exists() && !tessdata.mkdirs()) {
                throw new IllegalStateException("Unable to create OCR model directory.");
            }

            modelDownloaded |= ensureModel(tessdata, "ara.traineddata", ARA_MODEL_URL, call, cancelled);
            if (language.contains("eng")) modelDownloaded |= ensureModel(tessdata, "eng.traineddata", ENG_MODEL_URL, call, cancelled);
            checkCancelled(cancelled);

            descriptor = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(descriptor);
            int pageCount = renderer.getPageCount();
            if (pageCount < 1) throw new IllegalArgumentException("PDF has no pages.");

            int firstPage = Math.min(pageCount, requestedStart);
            int lastPage = Math.min(pageCount, requestedEnd);
            int totalPages = Math.max(0, lastPage - firstPage + 1);
            if (totalPages < 1) throw new IllegalArgumentException("The selected PDF pages are unavailable.");

            tess = new TessBaseAPI();
            boolean initialized = tess.init(dataRoot.getAbsolutePath(), language, TessBaseAPI.OEM_LSTM_ONLY);
            if (!initialized) throw new IllegalStateException("Unable to initialize Arabic OCR.");
            tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);
            tess.setVariable("preserve_interword_spaces", "1");

            StringBuilder combined = new StringBuilder();
            JSArray pages = new JSArray();

            for (int pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) {
                checkCancelled(cancelled);
                Log.d(TAG, "OCR page task=" + taskId + " page=" + pageNumber + " of=" + lastPage);
                sendProgress(call, "rendering", pageNumber, totalPages, firstPage);
                PdfRenderer.Page page = null;
                Bitmap source = null;
                Bitmap processed = null;
                try {
                    page = renderer.openPage(pageNumber - 1);
                    float ratio = requestedWidth / (float) Math.max(1, page.getWidth());
                    int height = Math.min(MAX_RENDER_HEIGHT, Math.max(1, Math.round(page.getHeight() * ratio)));
                    source = Bitmap.createBitmap(requestedWidth, height, Bitmap.Config.ARGB_8888);
                    source.eraseColor(Color.WHITE);
                    page.render(source, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    checkCancelled(cancelled);
                    processed = preprocess(source);
                    source.recycle();
                    source = null;

                    sendProgress(call, "recognizing", pageNumber, totalPages, firstPage);
                    tess.setImage(processed);
                    String text = tess.getUTF8Text();
                    if (text == null) text = "";
                    text = text.trim();
                    if (!text.isEmpty()) {
                        if (combined.length() > 0) combined.append("\n\n");
                        combined.append("--- صفحة ").append(pageNumber).append(" ---\n").append(text);
                    }

                    JSObject pageResult = new JSObject();
                    pageResult.put("page", pageNumber);
                    pageResult.put("text", text);
                    pageResult.put("confidence", Math.max(0, tess.meanConfidence()));
                    pages.put(pageResult);
                    tess.clear();
                } finally {
                    if (processed != null && processed != source && !processed.isRecycled()) processed.recycle();
                    if (source != null && !source.isRecycled()) source.recycle();
                    if (page != null) page.close();
                }
            }

            JSObject result = new JSObject();
            result.put("text", combined.toString());
            result.put("pages", pages);
            result.put("pageCount", pageCount);
            result.put("processedPages", totalPages);
            result.put("modelDownloaded", modelDownloaded);
            Log.i(TAG, "OCR complete task=" + taskId + " processedPages=" + totalPages);
            resolveCall(call, result);
        } catch (OutOfMemoryError error) {
            Log.e(TAG, "OCR out of memory task=" + taskId + " pages=" + requestedStart + "-" + requestedEnd, error);
            rejectCall(call, "ذاكرة الجهاز لا تكفي لمعالجة هذه الصفحة. قسّم النطاق أو أعد المحاولة بعد إغلاق التطبيقات الأخرى.", error);
        } catch (LinkageError error) {
            // Native OCR libraries may fail to load/resolve on a specific ABI. Let the
            // Java bridge report the failure instead of allowing the process to crash.
            Log.e(TAG, "OCR native linkage failure task=" + taskId + " pages=" + requestedStart + "-" + requestedEnd, error);
            rejectCall(call, "تعذر تشغيل محرك OCR على هذا الجهاز. سيتم تسجيل سبب الخطأ من Android Logcat.", error);
        } catch (Exception error) {
            Log.e(TAG, "OCR failed task=" + taskId + " pages=" + requestedStart + "-" + requestedEnd, error);
            String message = error.getMessage() == null ? "Unable to extract Arabic text from PDF." : error.getMessage();
            rejectCall(call, message, error);
        } finally {
            cancellations.remove(taskId);
            try {
                if (tess != null) tess.end();
            } catch (Throwable cleanupError) {
                Log.w(TAG, "OCR TessBaseAPI cleanup failed task=" + taskId, cleanupError);
            }
            try {
                if (renderer != null) renderer.close();
            } catch (Throwable cleanupError) {
                Log.w(TAG, "OCR PdfRenderer cleanup failed task=" + taskId, cleanupError);
            }
            try {
                if (descriptor != null) descriptor.close();
            } catch (Throwable cleanupError) {
                Log.w(TAG, "OCR descriptor cleanup failed task=" + taskId, cleanupError);
            }
        }
    }

    private void resolveCall(PluginCall call, JSObject result) {
        if (getActivity() != null) getActivity().runOnUiThread(() -> call.resolve(result));
        else call.resolve(result);
    }

    private void rejectCall(PluginCall call, String message, Throwable error) {
        if (getActivity() != null) getActivity().runOnUiThread(() -> call.reject(message, error));
        else call.reject(message, error);
    }

    private boolean ensureModel(File tessdata, String fileName, String sourceUrl, PluginCall call, AtomicBoolean cancelled) throws Exception {
        File target = new File(tessdata, fileName);
        if (target.exists() && target.length() > 100_000L) return false;
        if (copyBundledModel(tessdata, target, fileName, cancelled)) return false;

        sendProgress(call, "downloading-model", 0, 0, 0);
        File temporary = new File(tessdata, fileName + ".download");
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(sourceUrl).openConnection();
            connection.setConnectTimeout(20_000);
            connection.setReadTimeout(60_000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "Mobdea-Education-OCR/10.9");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("Unable to download the Arabic OCR model.");
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(temporary))) {
                byte[] buffer = new byte[32 * 1024];
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    checkCancelled(cancelled);
                    output.write(buffer, 0, read);
                }
                output.flush();
            }
            if (temporary.length() <= 100_000L) throw new IllegalStateException("The downloaded OCR model is incomplete.");
            if (target.exists() && !target.delete()) throw new IllegalStateException("Unable to replace the OCR model.");
            if (!temporary.renameTo(target)) throw new IllegalStateException("Unable to save the OCR model.");
            return true;
        } finally {
            if (connection != null) connection.disconnect();
            if (temporary.exists() && !target.exists()) temporary.delete();
        }
    }

    private boolean copyBundledModel(File tessdata, File target, String fileName, AtomicBoolean cancelled) throws Exception {
        File temporary = new File(tessdata, fileName + ".bundled");
        try (InputStream asset = getContext().getAssets().open(fileName + ".gz");
             GZIPInputStream input = new GZIPInputStream(new BufferedInputStream(asset));
             BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(temporary))) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                checkCancelled(cancelled);
                output.write(buffer, 0, read);
            }
            output.flush();
            if (temporary.length() <= 100_000L) throw new IOException("Bundled OCR model is incomplete.");
            if (target.exists() && !target.delete()) throw new IOException("Unable to replace OCR model.");
            if (!temporary.renameTo(target)) throw new IOException("Unable to install bundled OCR model.");
            return true;
        } catch (java.io.FileNotFoundException missingBundledModel) {
            return false;
        } finally {
            if (temporary.exists() && !target.exists()) temporary.delete();
        }
    }

    private Bitmap preprocess(Bitmap source) {
        Bitmap output = Bitmap.createBitmap(source.getWidth(), source.getHeight(), Bitmap.Config.RGB_565);
        Canvas canvas = new Canvas(output);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        ColorMatrix matrix = new ColorMatrix();
        matrix.setSaturation(0f);
        ColorMatrix contrast = new ColorMatrix(new float[] {
                1.35f, 0, 0, 0, -28,
                0, 1.35f, 0, 0, -28,
                0, 0, 1.35f, 0, -28,
                0, 0, 0, 1, 0
        });
        matrix.postConcat(contrast);
        paint.setColorFilter(new ColorMatrixColorFilter(matrix));
        canvas.drawColor(Color.WHITE);
        canvas.drawBitmap(source, 0, 0, paint);
        return output;
    }

    private void sendProgress(PluginCall call, String stage, int page, int totalPages, int firstPage) {
        JSObject progress = new JSObject();
        progress.put("stage", stage);
        progress.put("page", page);
        progress.put("totalPages", totalPages);
        progress.put("index", page > 0 ? page - firstPage + 1 : 0);
        notifyListeners("progress", progress);
    }

    private String sanitizeLanguage(String language) {
        String value = language == null ? "ara+eng" : language.replaceAll("[^a-z+_]", "");
        if (!value.contains("ara")) value = "ara+eng";
        return value;
    }

    private void checkCancelled(AtomicBoolean cancelled) throws InterruptedException {
        if (cancelled != null && cancelled.get()) throw new InterruptedException("تم إلغاء عملية OCR.");
    }

    private File resolveStagedAsset(String path) throws Exception {
        File directory = new File(getContext().getCacheDir(), "native-assets").getCanonicalFile();
        File target = new File(path).getCanonicalFile();
        if (!target.getPath().startsWith(directory.getPath() + File.separator)) {
            throw new SecurityException("OCR asset path is outside the app cache.");
        }
        return target;
    }
}
