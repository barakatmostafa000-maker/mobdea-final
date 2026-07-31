package com.mobdea.education.document;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "MobdeaDocumentViewer")
public class MobdeaDocumentViewerPlugin extends Plugin {
    private static final long MAX_DOCUMENT_BYTES = 200L * 1024L * 1024L;

    @PluginMethod
    public void open(PluginCall call) {
        final String base64 = call.getString("base64", "");
        final String requestedName = call.getString("fileName", "mobdea-document");
        final String mimeType = call.getString("mimeType", "application/octet-stream");
        if (base64.isEmpty()) {
            call.reject("Document data is required.");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_DOCUMENT_BYTES) {
                    throw new IllegalArgumentException("Document size is not supported.");
                }
                String safeName = requestedName.replaceAll("[^\\p{L}\\p{N}._-]", "_");
                if (safeName.isEmpty()) safeName = "mobdea-document";
                File directory = new File(getContext().getCacheDir(), "documents");
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Unable to create document cache.");
                File target = new File(directory, safeName);
                try (FileOutputStream output = new FileOutputStream(target)) {
                    output.write(bytes);
                    output.flush();
                }

                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", target);
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, mimeType);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        Intent chooser = Intent.createChooser(intent, "فتح الملف");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(chooser);
                        JSObject response = new JSObject();
                        response.put("ok", true);
                        response.put("fileName", target.getName());
                        call.resolve(response);
                    } catch (ActivityNotFoundException error) {
                        call.reject("لا يوجد تطبيق مثبت يستطيع فتح هذا النوع من الملفات.", error);
                    } catch (Exception error) {
                        call.reject("تعذر فتح الملف.", error);
                    }
                });
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject(error.getMessage() == null ? "تعذر تجهيز الملف." : error.getMessage(), error));
            }
        }).start();
    }
}
