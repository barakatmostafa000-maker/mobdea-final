package com.mobdea.education.update;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "MobdeaUpdater")
public class MobdeaUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 250L * 1024L * 1024L;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String rawUrl = call.getString("url", "").trim();
        final String expectedHash = call.getString("sha256", "").replaceAll("[^a-fA-F0-9]", "").toLowerCase(Locale.US);
        final String expectedPackage = call.getString("packageName", getContext().getPackageName()).trim();
        final Long expectedSize = call.getLong("sizeBytes", 0L);
        final URL downloadUrl;
        try {
            downloadUrl = new URL(rawUrl);
            if (!"https".equalsIgnoreCase(downloadUrl.getProtocol()) || downloadUrl.getUserInfo() != null || downloadUrl.getHost() == null || downloadUrl.getHost().trim().isEmpty()) {
                throw new IllegalArgumentException("Invalid update URL.");
            }
        } catch (Exception error) {
            call.reject("A trusted HTTPS URL is required.", error);
            return;
        }
        if (!expectedHash.matches("^[a-f0-9]{64}$")) {
            call.reject("A valid SHA-256 hash is required.");
            return;
        }

        new Thread(() -> {
            File target = null;
            try {
                File updateDir = new File(getContext().getCacheDir(), "updates");
                if (!updateDir.exists() && !updateDir.mkdirs()) throw new IllegalStateException("Unable to create update directory.");
                target = new File(updateDir, "mobdea-update.apk");
                if (target.exists() && !target.delete()) throw new IllegalStateException("Unable to replace old update file.");

                HttpURLConnection connection = (HttpURLConnection) downloadUrl.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(45000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("Download failed with HTTP " + status);
                long declaredSize = connection.getContentLength();
                if (declaredSize > MAX_APK_BYTES) throw new IllegalStateException("APK is too large.");
                if (expectedSize != null && expectedSize > 0 && declaredSize > 0 && expectedSize.longValue() != declaredSize) throw new IllegalStateException("APK size does not match the signed manifest.");

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long total = 0;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(target)) {
                    byte[] buffer = new byte[32 * 1024];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        total += read;
                        if (total > MAX_APK_BYTES) throw new IllegalStateException("APK exceeds the maximum allowed size.");
                        digest.update(buffer, 0, read);
                        output.write(buffer, 0, read);
                    }
                    output.flush();
                } finally {
                    connection.disconnect();
                }
                if (expectedSize != null && expectedSize > 0 && expectedSize.longValue() != total) throw new IllegalStateException("Downloaded APK size mismatch.");
                String actualHash = toHex(digest.digest());
                if (!actualHash.equals(expectedHash)) throw new SecurityException("Downloaded APK hash mismatch.");
                verifyPackage(target, expectedPackage);

                File finalTarget = target;
                long downloadedBytes = total;
                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", finalTarget);
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                        JSObject result = new JSObject();
                        result.put("ok", true);
                        result.put("sha256", actualHash);
                        result.put("sizeBytes", downloadedBytes);
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("Unable to open the verified APK installer.", error);
                    }
                });
            } catch (Exception error) {
                if (target != null && target.exists()) target.delete();
                String message = error.getMessage() == null ? "Update failed." : error.getMessage();
                getActivity().runOnUiThread(() -> call.reject(message, error));
            }
        }).start();
    }

    private void verifyPackage(File apk, String expectedPackage) throws Exception {
        PackageManager packageManager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = packageManager.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo current = packageManager.getPackageInfo(getContext().getPackageName(), flags);
        if (archive == null || !expectedPackage.equals(archive.packageName) || !getContext().getPackageName().equals(archive.packageName)) {
            throw new SecurityException("APK package name mismatch.");
        }
        Set<String> archiveSigners = signatureDigests(archive);
        Set<String> currentSigners = signatureDigests(current);
        if (archiveSigners.isEmpty() || !archiveSigners.equals(currentSigners)) throw new SecurityException("APK signing certificate mismatch.");
    }

    private Set<String> signatureDigests(PackageInfo info) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return new HashSet<>();
            signatures = info.signingInfo.getApkContentsSigners();
        } else {
            signatures = info.signatures;
        }
        Set<String> result = new HashSet<>();
        if (signatures == null) return result;
        for (Signature signature : signatures) result.add(toHex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return result;
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value));
        return builder.toString();
    }
}
