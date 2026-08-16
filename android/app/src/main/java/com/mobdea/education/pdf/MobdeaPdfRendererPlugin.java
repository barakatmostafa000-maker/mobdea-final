package com.mobdea.education.pdf;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;

@CapacitorPlugin(name = "MobdeaPdfRenderer")
public class MobdeaPdfRendererPlugin extends Plugin {
    private static final long MAX_PDF_BYTES = 500L * 1024L * 1024L;
    private static final int MAX_RENDER_WIDTH = 2200;

    @PluginMethod
    public void renderPage(PluginCall call) {
        final String assetPath = call.getString("assetPath", "");
        final int requestedPage = Math.max(1, call.getInt("page", 1));
        final int requestedWidth = Math.min(MAX_RENDER_WIDTH, Math.max(640, call.getInt("maxWidth", 1600)));
        if (assetPath.isEmpty()) {
            call.reject("A staged PDF path is required.");
            return;
        }

        new Thread(() -> {
            File pdfFile = null;
            ParcelFileDescriptor descriptor = null;
            PdfRenderer renderer = null;
            PdfRenderer.Page page = null;
            Bitmap bitmap = null;
            try {
                pdfFile = resolveStagedAsset(assetPath);
                if (!pdfFile.exists() || pdfFile.length() == 0 || pdfFile.length() > MAX_PDF_BYTES) throw new IllegalArgumentException("PDF size is not supported.");

                descriptor = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY);
                renderer = new PdfRenderer(descriptor);
                int pageCount = renderer.getPageCount();
                if (pageCount < 1) throw new IllegalArgumentException("PDF has no pages.");
                int pageIndex = Math.min(pageCount - 1, requestedPage - 1);
                page = renderer.openPage(pageIndex);
                float ratio = requestedWidth / (float) Math.max(1, page.getWidth());
                int height = Math.max(1, Math.round(page.getHeight() * ratio));
                bitmap = Bitmap.createBitmap(requestedWidth, height, Bitmap.Config.ARGB_8888);
                bitmap.eraseColor(Color.WHITE);
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);

                ByteArrayOutputStream png = new ByteArrayOutputStream();
                if (!bitmap.compress(Bitmap.CompressFormat.PNG, 92, png)) throw new IllegalStateException("Unable to encode PDF page.");
                JSObject result = new JSObject();
                result.put("dataUrl", "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP));
                result.put("page", pageIndex + 1);
                result.put("pageCount", pageCount);
                result.put("width", requestedWidth);
                result.put("height", height);
                result.put("asset", pdfFile.getName());
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception error) {
                String message = error.getMessage() == null ? "Unable to render PDF page." : error.getMessage();
                getActivity().runOnUiThread(() -> call.reject(message, error));
            } finally {
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
                if (page != null) page.close();
                if (renderer != null) renderer.close();
                try { if (descriptor != null) descriptor.close(); } catch (Exception ignored) { }
            }
        }).start();
    }

    private File resolveStagedAsset(String path) throws Exception {
        File directory = new File(getContext().getCacheDir(), "native-assets").getCanonicalFile();
        File target = new File(path).getCanonicalFile();
        if (!target.getPath().startsWith(directory.getPath() + File.separator)) {
            throw new SecurityException("PDF asset path is outside the app cache.");
        }
        return target;
    }
}
