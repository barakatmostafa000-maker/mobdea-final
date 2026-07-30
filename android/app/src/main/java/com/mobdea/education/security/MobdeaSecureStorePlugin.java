package com.mobdea.education.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "MobdeaSecureStore")
public class MobdeaSecureStorePlugin extends Plugin {
    private static final String KEY_ALIAS = "mobdea_secure_store_key_v1";
    private static final String PREFS_NAME = "mobdea_secure_store_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv = cipher.getIV();
        byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return "v1:" + Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ciphertext, Base64.NO_WRAP);
    }

    private String decrypt(String envelope) throws Exception {
        String[] parts = envelope.split(":", 3);
        if (parts.length != 3 || !"v1".equals(parts[0])) throw new IllegalArgumentException("Invalid secure value.");
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, Base64.decode(parts[1], Base64.NO_WRAP)));
        byte[] plaintext = cipher.doFinal(Base64.decode(parts[2], Base64.NO_WRAP));
        return new String(plaintext, StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key", "").trim();
        String value = call.getString("value", "");
        if (key.isEmpty()) {
            call.reject("Key is required.");
            return;
        }
        try {
            boolean saved = preferences().edit().putString(key, encrypt(value)).commit();
            if (!saved) throw new IllegalStateException("Unable to persist secure value.");
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to encrypt secure value.", error);
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key", "").trim();
        JSObject result = new JSObject();
        if (key.isEmpty()) {
            result.put("value", null);
            call.resolve(result);
            return;
        }
        String envelope = preferences().getString(key, null);
        if (envelope == null) {
            result.put("value", null);
            call.resolve(result);
            return;
        }
        try {
            result.put("value", decrypt(envelope));
            call.resolve(result);
        } catch (Exception error) {
            preferences().edit().remove(key).commit();
            call.reject("Secure value is unavailable or corrupted.", error);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key", "").trim();
        if (!key.isEmpty() && !preferences().edit().remove(key).commit()) {
            call.reject("Unable to remove secure value.");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        if (!preferences().edit().clear().commit()) {
            call.reject("Unable to clear secure values.");
            return;
        }
        call.resolve();
    }
}
