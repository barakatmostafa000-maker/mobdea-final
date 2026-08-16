package com.mobdea.education.assets;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "MobdeaNativeAsset")
public class MobdeaNativeAssetPlugin extends Plugin {
    private static final long MAX_ASSET_BYTES = 500L * 1024L * 1024L;
    private static final int MAX_CHUNK_BYTES = 768 * 1024;

    @PluginMethod
    public void begin(PluginCall call) {
        long expectedSize = readAssetSize(call);
        if (expectedSize <= 0L || expectedSize > MAX_ASSET_BYTES) {
            call.reject("Native asset size is not supported.");
            return;
        }
        try {
            File directory = assetDirectory();
            String token = UUID.randomUUID().toString();
            File target = new File(directory, token + ".part");
            if (!target.createNewFile()) throw new IllegalStateException("Unable to create native asset file.");
            JSObject result = new JSObject();
            result.put("token", token);
            result.put("path", target.getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void append(PluginCall call) {
        String token = sanitizeToken(call.getString("token", ""));
        String base64 = call.getString("base64", "");
        if (token.isEmpty() || base64.isEmpty()) {
            call.reject("Native asset token and chunk are required.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            if (bytes.length <= 0 || bytes.length > MAX_CHUNK_BYTES) {
                throw new IllegalArgumentException("Native asset chunk is not supported.");
            }
            File target = resolveTokenFile(token, ".part");
            if (!target.exists()) throw new IllegalStateException("Native asset upload was not found.");
            if (target.length() + bytes.length > MAX_ASSET_BYTES) throw new IllegalArgumentException("Native asset is too large.");
            try (FileOutputStream output = new FileOutputStream(target, true)) {
                output.write(bytes);
                output.flush();
            }
            JSObject result = new JSObject();
            result.put("bytesWritten", target.length());
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void finish(PluginCall call) {
        String token = sanitizeToken(call.getString("token", ""));
        long expectedSize = readAssetSize(call);
        try {
            File partial = resolveTokenFile(token, ".part");
            if (!partial.exists() || partial.length() != expectedSize) {
                throw new IllegalStateException("Native asset upload is incomplete.");
            }
            File ready = resolveTokenFile(token, ".bin");
            if (ready.exists() && !ready.delete()) throw new IllegalStateException("Unable to replace staged native asset.");
            if (!partial.renameTo(ready)) throw new IllegalStateException("Unable to finish native asset upload.");
            JSObject result = new JSObject();
            result.put("path", ready.getAbsolutePath());
            result.put("size", ready.length());
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void release(PluginCall call) {
        String path = call.getString("path", "");
        try {
            File target = resolvePath(path);
            boolean deleted = !target.exists() || target.delete();
            JSObject result = new JSObject();
            result.put("deleted", deleted);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    private long readAssetSize(PluginCall call) {
        double value = call.getDouble("size", 0d);
        if (!Double.isFinite(value) || value <= 0d || value > Long.MAX_VALUE) return 0L;
        return Math.round(value);
    }

    private File assetDirectory() throws Exception {
        File directory = new File(getContext().getCacheDir(), "native-assets");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Unable to create native asset cache.");
        return directory.getCanonicalFile();
    }

    private File resolveTokenFile(String token, String suffix) throws Exception {
        if (token.isEmpty()) throw new IllegalArgumentException("Native asset token is invalid.");
        return resolvePath(new File(assetDirectory(), token + suffix).getAbsolutePath());
    }

    private File resolvePath(String path) throws Exception {
        File directory = assetDirectory();
        File target = new File(path).getCanonicalFile();
        if (!target.getPath().startsWith(directory.getPath() + File.separator)) {
            throw new SecurityException("Native asset path is outside the app cache.");
        }
        return target;
    }

    private String sanitizeToken(String token) {
        return String.valueOf(token).matches("[a-fA-F0-9-]{20,64}") ? token : "";
    }
}
