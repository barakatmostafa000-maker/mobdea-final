package com.mobdea.education.handwriting;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.recognition.Ink;
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext;
import com.google.mlkit.vision.digitalink.recognition.WritingArea;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Native vector handwriting recognition for the classroom whiteboard.
 *
 * The WebView passes the original ordered pen strokes, rather than a bitmap.
 * ML Kit's Digital Ink recognizer can therefore use stroke order and writing
 * area information that image OCR cannot see. Arabic is the default model.
 */
@CapacitorPlugin(name = "MobdeaDigitalInk")
public class MobdeaDigitalInkPlugin extends Plugin {

    @PluginMethod
    public void recognize(PluginCall call) {
        String languageTag = call.getString("languageTag", "ar");
        JSArray strokeArray = call.getArray("strokes");
        if (strokeArray == null || strokeArray.length() == 0) {
            call.reject("No handwriting strokes were provided.");
            return;
        }

        final DigitalInkRecognitionModelIdentifier identifier;
        try {
            identifier = DigitalInkRecognitionModelIdentifier.fromLanguageTag(languageTag);
        } catch (MlKitException error) {
            call.reject("The handwriting language is not supported.", error);
            return;
        }
        if (identifier == null) {
            call.reject("No handwriting model is available for this language.");
            return;
        }

        final InkPayload payload;
        try {
            payload = buildInk(strokeArray);
        } catch (JSONException error) {
            call.reject("The handwriting stroke data is invalid.", error);
            return;
        }
        if (payload.strokeCount == 0) {
            call.reject("No valid handwriting strokes were provided.");
            return;
        }

        DigitalInkRecognitionModel model = DigitalInkRecognitionModel.builder(identifier).build();
        RemoteModelManager manager = RemoteModelManager.getInstance();
        DownloadConditions conditions = new DownloadConditions.Builder().build();

        // download() is idempotent for an already installed model. The first use
        // may need the network; later recognitions run on-device with the model.
        manager.download(model, conditions)
                .addOnSuccessListener(ignored -> recognizeWithModel(call, model, payload))
                .addOnFailureListener(error -> call.reject(
                        "تعذر تجهيز نموذج التعرف على خط اليد. اتصل بالإنترنت مرة واحدة ثم أعد المحاولة.",
                        error
                ));
    }

    private void recognizeWithModel(PluginCall call, DigitalInkRecognitionModel model, InkPayload payload) {
        DigitalInkRecognizer recognizer = DigitalInkRecognition.getClient(
                DigitalInkRecognizerOptions.builder(model).build()
        );

        String preContext = call.getString("preContext", "");
        if (preContext == null) preContext = "";
        if (preContext.length() > 20) preContext = preContext.substring(preContext.length() - 20);

        RecognitionContext context = RecognitionContext.builder()
                .setPreContext(preContext)
                .setWritingArea(new WritingArea(payload.width, payload.height))
                .build();

        recognizer.recognize(payload.ink, context)
                .addOnSuccessListener(result -> {
                    try {
                        JSArray candidates = new JSArray();
                        String best = "";
                        Float bestScore = null;
                        int limit = Math.min(5, result.getCandidates().size());
                        for (int index = 0; index < limit; index += 1) {
                            String text = result.getCandidates().get(index).getText();
                            if (index == 0) {
                                if (text != null) best = text;
                                bestScore = result.getCandidates().get(index).getScore();
                            }
                            if (text != null && !text.trim().isEmpty()) candidates.put(text);
                        }
                        JSObject response = new JSObject();
                        response.put("text", best == null ? "" : best.trim());
                        response.put("candidates", candidates);
                        // Text models such as Arabic may not expose a calibrated score.
                        // Never fabricate a percentage; preserve the raw model score only
                        // when ML Kit provides one for the selected model.
                        if (bestScore != null) response.put("score", bestScore);
                        response.put("engine", "mlkit-digital-ink");
                        response.put("languageTag", model.getModelIdentifier().getLanguageTag());
                        response.put("strokeCount", payload.strokeCount);
                        call.resolve(response);
                    } finally {
                        recognizer.close();
                    }
                })
                .addOnFailureListener(error -> {
                    recognizer.close();
                    call.reject("تعذر التعرف على خط اليد في هذه المحاولة.", error);
                });
    }

    private InkPayload buildInk(JSONArray strokes) throws JSONException {
        float minX = Float.MAX_VALUE;
        float minY = Float.MAX_VALUE;
        float maxX = -Float.MAX_VALUE;
        float maxY = -Float.MAX_VALUE;

        for (int strokeIndex = 0; strokeIndex < strokes.length(); strokeIndex += 1) {
            JSONObject stroke = strokes.optJSONObject(strokeIndex);
            if (stroke == null) continue;
            JSONArray points = stroke.optJSONArray("points");
            if (points == null) continue;
            for (int pointIndex = 0; pointIndex < points.length(); pointIndex += 1) {
                JSONObject point = points.optJSONObject(pointIndex);
                if (point == null) continue;
                float x = (float) point.optDouble("x", 0d);
                float y = (float) point.optDouble("y", 0d);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }

        if (minX == Float.MAX_VALUE || minY == Float.MAX_VALUE) {
            return new InkPayload(Ink.builder().build(), 1f, 1f, 0);
        }

        final float padding = 24f;
        Ink.Builder inkBuilder = Ink.builder();
        int acceptedStrokes = 0;
        long syntheticTime = 1L;

        for (int strokeIndex = 0; strokeIndex < strokes.length(); strokeIndex += 1) {
            JSONObject stroke = strokes.optJSONObject(strokeIndex);
            if (stroke == null) continue;
            JSONArray points = stroke.optJSONArray("points");
            if (points == null || points.length() < 2) continue;
            Ink.Stroke.Builder strokeBuilder = Ink.Stroke.builder();
            int acceptedPoints = 0;
            for (int pointIndex = 0; pointIndex < points.length(); pointIndex += 1) {
                JSONObject point = points.optJSONObject(pointIndex);
                if (point == null) continue;
                float x = (float) point.optDouble("x", 0d) - minX + padding;
                float y = (float) point.optDouble("y", 0d) - minY + padding;
                long t = point.has("t") ? point.optLong("t", syntheticTime) : syntheticTime;
                syntheticTime = Math.max(syntheticTime + 1L, t + 1L);
                strokeBuilder.addPoint(Ink.Point.create(x, y, t));
                acceptedPoints += 1;
            }
            if (acceptedPoints >= 2) {
                inkBuilder.addStroke(strokeBuilder.build());
                acceptedStrokes += 1;
            }
        }

        float width = Math.max(120f, maxX - minX + padding * 2f);
        // RecognitionContext works best when this approximates one handwritten
        // line. Keep it close to the ink height rather than the whole board.
        float height = Math.max(64f, maxY - minY + padding * 2f);
        return new InkPayload(inkBuilder.build(), width, height, acceptedStrokes);
    }

    private static class InkPayload {
        final Ink ink;
        final float width;
        final float height;
        final int strokeCount;

        InkPayload(Ink ink, float width, float height, int strokeCount) {
            this.ink = ink;
            this.width = width;
            this.height = height;
            this.strokeCount = strokeCount;
        }
    }
}
