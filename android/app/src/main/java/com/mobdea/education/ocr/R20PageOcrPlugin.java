package com.mobdea.education.ocr;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.googlecode.tesseract.android.TessBaseAPI;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;

@CapacitorPlugin(name = "R20PageOcr")
public class R20PageOcrPlugin extends Plugin {
    private static final String MARKER = "R20_FIX08_NATIVE_PAGE_OCR_V1";
    private static final String MODEL_VERSION = "tess304-r20-page-ocr-v1";
    private static final String[] MODELS = new String[] {
        "ara.traineddata","ara.cube.bigrams","ara.cube.fold","ara.cube.lm",
        "ara.cube.nn","ara.cube.params","ara.cube.size","ara.cube.word-freq",
        "eng.traineddata","eng.cube.bigrams","eng.cube.fold","eng.cube.lm",
        "eng.cube.nn","eng.cube.params","eng.cube.size","eng.cube.word-freq",
        "eng.tesseract_cube.nn"
    };

    @PluginMethod public void healthCheck(PluginCall call) {
        new Thread(() -> {
            try {
                installModelPack();
                JSObject out = new JSObject();
                out.put("ok", true);
                out.put("ready", true);
                out.put("modelCount", MODELS.length);
                out.put("languages", "ara+eng");
                out.put("engine", "native-tess-two");
                out.put("marker", MARKER);
                call.resolve(out);
            } catch (Exception e) {
                rejectSafe(call);
            }
        }, "r20-ocr-health").start();
    }

    @PluginMethod public void recognizePdfPage(PluginCall call) { execute(call); }
    @PluginMethod public void recognizePage(PluginCall call) { execute(call); }
    @PluginMethod public void ocrPage(PluginCall call) { execute(call); }
    @PluginMethod public void extractText(PluginCall call) { execute(call); }
    @PluginMethod public void recognize(PluginCall call) { execute(call); }

    private void execute(PluginCall call) {
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                File dataRoot = installModelPack();
                int pageIndex = readPageIndex(call);
                String lang = safeLang(first(call.getString("language"), call.getString("lang"), "ara+eng"));
                String image = first(call.getString("imageBase64"), call.getString("base64"), null);

                if (image != null) {
                    bitmap = decodeImage(image);
                } else {
                    String path = first(
                        call.getString("pdfPath"),
                        call.getString("filePath"),
                        first(call.getString("path"), call.getString("uri"), null)
                    );
                    if (path == null) {
                        call.reject("OCR source is unavailable.");
                        return;
                    }
                    bitmap = renderPdfPage(path, pageIndex);
                }

                if (bitmap == null) {
                    call.reject("OCR page could not be prepared.");
                    return;
                }

                Bitmap argb = ensureArgb8888(bitmap);
                if (argb != bitmap) {
                    bitmap.recycle();
                    bitmap = argb;
                }

                TessBaseAPI api = new TessBaseAPI();
                String text;
                try {
                    if (!api.init(dataRoot.getAbsolutePath(), lang)) {
                        call.reject("OCR engine could not start.");
                        return;
                    }
                    api.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);
                    api.setImage(bitmap);
                    text = api.getUTF8Text();
                    if (text == null) text = "";
                    text = normalize(text);
                } finally {
                    try { api.clear(); } catch (Exception ignored) {}
                    try { api.end(); } catch (Exception ignored) {}
                }

                JSObject out = new JSObject();
                out.put("ok", true);
                out.put("text", text);
                out.put("recognizedText", text);
                out.put("ocrText", text);
                out.put("content", text);
                out.put("pageIndex", pageIndex);
                out.put("pageNumber", pageIndex + 1);
                out.put("language", lang);
                out.put("engine", "native-tess-two");
                out.put("marker", MARKER);
                call.resolve(out);
            } catch (Exception e) {
                rejectSafe(call);
            } finally {
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
            }
        }, "r20-page-ocr").start();
    }

    private File installModelPack() throws Exception {
        File root = new File(getContext().getFilesDir(), "r20-page-ocr");
        File tessdata = new File(root, "tessdata");
        File marker = new File(root, ".model-version");

        boolean valid = tessdata.isDirectory()
            && marker.isFile()
            && MODEL_VERSION.equals(read(marker));

        if (valid) {
            for (String name : MODELS) {
                File f = new File(tessdata, name);
                if (!f.isFile() || f.length() <= 0L) {
                    valid = false;
                    break;
                }
            }
        }

        if (!valid) {
            deleteTree(root);
            if (!tessdata.mkdirs() && !tessdata.isDirectory()) {
                throw new IllegalStateException("OCR data unavailable");
            }

            String[] bundled = getContext().getAssets().list("tess304");
            if (bundled == null) bundled = new String[0];

            for (String name : MODELS) {
                if (!Arrays.asList(bundled).contains(name)) {
                    throw new IllegalStateException("OCR model pack incomplete");
                }
                copyAsset("tess304/" + name, new File(tessdata, name));
            }
            write(marker, MODEL_VERSION);
        }
        return root;
    }

    private Bitmap renderPdfPage(String raw, int pageIndex) throws Exception {
        ParcelFileDescriptor fd = null;
        PdfRenderer renderer = null;
        PdfRenderer.Page page = null;
        try {
            fd = openDescriptor(raw);
            if (fd == null) throw new IllegalStateException("PDF unavailable");
            renderer = new PdfRenderer(fd);
            if (renderer.getPageCount() < 1) throw new IllegalStateException("PDF empty");

            int safe = Math.max(0, Math.min(pageIndex, renderer.getPageCount() - 1));
            page = renderer.openPage(safe);

            int w0 = Math.max(1, page.getWidth());
            int h0 = Math.max(1, page.getHeight());
            float scale = Math.min(3f, Math.max(1.5f, 2200f / Math.max(w0, h0)));
            int w = Math.max(1, Math.round(w0 * scale));
            int h = Math.max(1, Math.round(h0 * scale));

            Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(0xFFFFFFFF);
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            return bitmap;
        } finally {
            if (page != null) try { page.close(); } catch (Exception ignored) {}
            if (renderer != null) try { renderer.close(); } catch (Exception ignored) {}
            if (fd != null) try { fd.close(); } catch (Exception ignored) {}
        }
    }

    private ParcelFileDescriptor openDescriptor(String raw) throws Exception {
        String value = raw.trim();
        if (value.startsWith("content://")) {
            return getContext().getContentResolver().openFileDescriptor(Uri.parse(value), "r");
        }
        if (value.startsWith("file://")) {
            String path = Uri.parse(value).getPath();
            if (path == null) return null;
            value = path;
        }
        return ParcelFileDescriptor.open(new File(value), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    private Bitmap decodeImage(String encoded) {
        String value = encoded.trim();
        int comma = value.indexOf(',');
        if (value.startsWith("data:") && comma >= 0) value = value.substring(comma + 1);
        byte[] bytes = Base64.decode(value, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap == null) throw new IllegalArgumentException("Invalid OCR image");
        return bitmap;
    }

    private Bitmap ensureArgb8888(Bitmap bitmap) {
        if (bitmap.getConfig() == Bitmap.Config.ARGB_8888) return bitmap;
        Bitmap converted = bitmap.copy(Bitmap.Config.ARGB_8888, false);
        if (converted == null) throw new IllegalStateException("ARGB_8888 conversion failed");
        return converted;
    }

    private int readPageIndex(PluginCall call) {
        Integer index = call.getInt("pageIndex");
        if (index != null) return Math.max(0, index);

        Integer number = call.getInt("pageNumber");
        if (number != null) return Math.max(0, number - 1);

        Integer page = call.getInt("page");
        if (page == null) return 0;

        Boolean oneBased = call.getBoolean("oneBased");
        return Boolean.TRUE.equals(oneBased) ? Math.max(0, page - 1) : Math.max(0, page);
    }

    private String safeLang(String value) {
        String clean = value.replaceAll("[^A-Za-z+_]", "").trim();
        return clean.isEmpty() || clean.length() > 32 ? "ara+eng" : clean;
    }

    private String normalize(String text) {
        return text.replace('\u0000', ' ')
            .replaceAll("[\\t\\x0B\\f\\r ]+", " ")
            .replaceAll("\\n[ ]+", "\n")
            .replaceAll("\\n{3,}", "\n\n")
            .trim();
    }

    private String first(String a, String b, String fallback) {
        if (a != null && !a.trim().isEmpty()) return a.trim();
        if (b != null && !b.trim().isEmpty()) return b.trim();
        return fallback;
    }

    private void copyAsset(String asset, File target) throws Exception {
        try (InputStream in = getContext().getAssets().open(asset);
             FileOutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[65536];
            int n;
            while ((n = in.read(buffer)) >= 0) out.write(buffer, 0, n);
            out.flush();
        }
    }

    private String read(File file) throws Exception {
        return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8).trim();
    }

    private void write(File file, String value) throws Exception {
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(value.getBytes(StandardCharsets.UTF_8));
        }
    }

    private void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    private void rejectSafe(PluginCall call) {
        call.reject("OCR failed. Please retry the page.");
    }
}
