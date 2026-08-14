package com.mobdea.education.pptx;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "MobdeaPptxRenderer")
public class MobdeaPptxRendererPlugin extends Plugin {
    private static final long MAX_PPTX_BYTES = 100L * 1024L * 1024L;
    private static final long MAX_ENTRY_BYTES = 18L * 1024L * 1024L;
    private static final long MAX_IMAGE_BYTES = 8L * 1024L * 1024L;
    private static final long MAX_TOTAL_IMAGE_BYTES = 36L * 1024L * 1024L;
    private static final long DEFAULT_SLIDE_CX = 12_192_000L;
    private static final long DEFAULT_SLIDE_CY = 6_858_000L;

    private static final Pattern SLIDE_PATTERN = Pattern.compile("ppt/slides/slide(\\d+)\\.xml", Pattern.CASE_INSENSITIVE);
    private static final Pattern TEXT_PATTERN = Pattern.compile("<(?:[a-zA-Z0-9_]+:)?t(?:\\s[^>]*)?>(.*?)</(?:[a-zA-Z0-9_]+:)?t>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern SHAPE_PATTERN = Pattern.compile("<p:sp(?:\\s[^>]*)?>(.*?)</p:sp>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern PICTURE_PATTERN = Pattern.compile("<p:pic(?:\\s[^>]*)?>(.*?)</p:pic>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern OFFSET_PATTERN = Pattern.compile("<a:off[^>]*\\bx=\"(\\d+)\"[^>]*\\by=\"(\\d+)\"[^>]*/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXTENT_PATTERN = Pattern.compile("<a:ext[^>]*\\bcx=\"(\\d+)\"[^>]*\\bcy=\"(\\d+)\"[^>]*/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMBED_PATTERN = Pattern.compile("\\br:embed=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern RUN_PROPS_PATTERN = Pattern.compile("<a:(?:rPr|defRPr)([^>]*)/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern SOLID_COLOR_PATTERN = Pattern.compile("<a:solidFill>.*?<a:srgbClr[^>]*\\bval=\"([0-9A-Fa-f]{6})\"", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern SHAPE_PROPS_PATTERN = Pattern.compile("<p:spPr(?:\\s[^>]*)?>(.*?)</p:spPr>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern PRESET_GEOMETRY_PATTERN = Pattern.compile("<a:prstGeom[^>]*\\bprst=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern LINE_PATTERN = Pattern.compile("<a:ln([^>]*)>(.*?)</a:ln>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern ROTATION_PATTERN = Pattern.compile("<a:xfrm([^>]*)>", Pattern.CASE_INSENSITIVE);
    private static final Pattern ALIGN_PATTERN = Pattern.compile("<a:pPr[^>]*\\balgn=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern BACKGROUND_PATTERN = Pattern.compile("<p:bg(?:\\s[^>]*)?>(.*?)</p:bg>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern RELATIONSHIP_PATTERN = Pattern.compile("<Relationship\\b([^>]*)/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("<p:ph([^>]*)/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern SLIDE_SIZE_PATTERN = Pattern.compile("<p:sldSz[^>]*\\bcx=\"(\\d+)\"[^>]*\\bcy=\"(\\d+)\"", Pattern.CASE_INSENSITIVE);

    @PluginMethod
    public void parse(PluginCall call) {
        final String assetPath = call.getString("assetPath", "");
        if (assetPath.isEmpty()) {
            call.reject("A staged PowerPoint path is required.");
            return;
        }

        new Thread(() -> {
            try {
                File source = resolveStagedAsset(assetPath);
                if (!source.exists() || source.length() == 0 || source.length() > MAX_PPTX_BYTES) {
                    throw new IllegalArgumentException("حجم ملف PowerPoint غير مدعوم داخل المنصة.");
                }
                Map<String, byte[]> entries = readEntries(source);
                long[] slideSize = readSlideSize(entries.get("ppt/presentation.xml"));
                List<SlideEntry> slideEntries = new ArrayList<>();
                for (String name : entries.keySet()) {
                    Matcher matcher = SLIDE_PATTERN.matcher(name);
                    if (matcher.matches()) slideEntries.add(new SlideEntry(name, Integer.parseInt(matcher.group(1))));
                }
                Collections.sort(slideEntries, new Comparator<SlideEntry>() {
                    @Override
                    public int compare(SlideEntry left, SlideEntry right) {
                        if (left.number < right.number) return -1;
                        if (left.number > right.number) return 1;
                        return 0;
                    }
                });
                if (slideEntries.isEmpty()) throw new IllegalArgumentException("لم يتم العثور على شرائح داخل ملف PowerPoint.");

                JSArray slides = new JSArray();
                long[] totalImageBytes = new long[] { 0L };
                for (SlideEntry slideEntry : slideEntries) {
                    byte[] slideBytes = entries.get(slideEntry.path);
                    String relsPath = "ppt/slides/_rels/slide" + slideEntry.number + ".xml.rels";
                    byte[] slideRelationshipBytes = entries.get(relsPath);
                    Map<String, String> relationships = extractRelationships(slideRelationshipBytes, slideEntry.path);
                    String layoutPath = extractRelationshipTarget(slideRelationshipBytes, slideEntry.path, "/slideLayout");
                    byte[] layoutBytes = layoutPath.isEmpty() ? null : entries.get(layoutPath);
                    JSObject slide = new JSObject();
                    slide.put("id", slideEntry.path);
                    slide.put("number", slideEntry.number);
                    slide.put("width", slideSize[0]);
                    slide.put("height", slideSize[1]);
                    slide.put("texts", extractTexts(slideBytes));
                    slide.put("background", extractBackground(slideBytes, layoutBytes));
                    slide.put("elements", extractElements(slideBytes, relationships, entries, slideSize[0], slideSize[1], totalImageBytes, layoutBytes));
                    // Images are already represented as positioned elements above. Keeping a
                    // second unpositioned copy here used to count the same bytes twice and could
                    // prematurely hit MAX_TOTAL_IMAGE_BYTES on image-heavy presentations.
                    slide.put("images", new JSArray());
                    slides.put(slide);
                }

                JSObject result = new JSObject();
                result.put("slides", slides);
                result.put("slideCount", slides.length());
                result.put("layoutAware", true);
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception error) {
                String message = error.getMessage() == null ? "تعذر تجهيز عرض PowerPoint." : error.getMessage();
                getActivity().runOnUiThread(() -> call.reject(message, error));
            }
        }).start();
    }

    private Map<String, byte[]> readEntries(File source) throws Exception {
        Map<String, byte[]> entries = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new FileInputStream(source))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String name = normalizePath(entry.getName());
                if (!(name.startsWith("ppt/slides/") || name.startsWith("ppt/slideLayouts/") || name.startsWith("ppt/media/") || "ppt/presentation.xml".equals(name))) continue;
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[32 * 1024];
                int read;
                long total = 0;
                while ((read = zip.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_ENTRY_BYTES) throw new IllegalArgumentException("يحتوي العرض على عنصر أكبر من الحد المدعوم.");
                    output.write(buffer, 0, read);
                }
                entries.put(name, output.toByteArray());
            }
        }
        return entries;
    }

    private long[] readSlideSize(byte[] presentationBytes) {
        if (presentationBytes == null) return new long[] { DEFAULT_SLIDE_CX, DEFAULT_SLIDE_CY };
        Matcher matcher = SLIDE_SIZE_PATTERN.matcher(new String(presentationBytes, StandardCharsets.UTF_8));
        if (!matcher.find()) return new long[] { DEFAULT_SLIDE_CX, DEFAULT_SLIDE_CY };
        return new long[] { parseLong(matcher.group(1), DEFAULT_SLIDE_CX), parseLong(matcher.group(2), DEFAULT_SLIDE_CY) };
    }

    private JSArray extractElements(byte[] xmlBytes, Map<String, String> relationships, Map<String, byte[]> entries, long slideWidth, long slideHeight, long[] totalImageBytes, byte[] layoutBytes) throws JSONException {
        JSArray elements = new JSArray();
        if (xmlBytes == null) return elements;
        String xml = new String(xmlBytes, StandardCharsets.UTF_8);
        Map<String, String> layoutPlaceholders = extractPlaceholderBlocks(layoutBytes);

        Matcher shapeMatcher = SHAPE_PATTERN.matcher(xml);
        while (shapeMatcher.find()) {
            String block = shapeMatcher.group(1);
            String text = joinTexts(block);
            String placeholder = placeholderKey(block);
            String inheritedBlock = placeholder.isEmpty() ? "" : layoutPlaceholders.get(placeholder);
            if (inheritedBlock == null) inheritedBlock = "";
            Matcher shapePropsMatcher = SHAPE_PROPS_PATTERN.matcher(block);
            String shapeProps = shapePropsMatcher.find() ? shapePropsMatcher.group(1) : "";
            Matcher inheritedShapePropsMatcher = SHAPE_PROPS_PATTERN.matcher(inheritedBlock);
            String inheritedShapeProps = inheritedShapePropsMatcher.find() ? inheritedShapePropsMatcher.group(1) : "";
            Matcher geometryMatcher = PRESET_GEOMETRY_PATTERN.matcher(shapeProps);
            String geometry = geometryMatcher.find() ? geometryMatcher.group(1) : "";
            if (geometry.isEmpty()) {
                Matcher inheritedGeometry = PRESET_GEOMETRY_PATTERN.matcher(inheritedShapeProps);
                if (inheritedGeometry.find()) geometry = inheritedGeometry.group(1);
            }
            if (text.isEmpty() && geometry.isEmpty()) continue;
            long[] box = readBox(block, inheritedBlock);
            JSObject item = positionObject(geometry.isEmpty() ? "text" : "shape", box, slideWidth, slideHeight);
            item.put("text", text);
            if (!geometry.isEmpty()) item.put("shapeKind", normalizeShapeKind(geometry));
            String effectiveShapeProps = shapeProps.isEmpty() ? inheritedShapeProps : shapeProps;
            Matcher shapeFill = SOLID_COLOR_PATTERN.matcher(effectiveShapeProps);
            if (shapeFill.find()) item.put("fill", "#" + shapeFill.group(1).toUpperCase(Locale.US));
            else if (effectiveShapeProps.contains("<a:noFill")) item.put("fill", "transparent");
            Matcher line = LINE_PATTERN.matcher(effectiveShapeProps);
            if (line.find()) {
                Matcher lineColor = SOLID_COLOR_PATTERN.matcher(line.group(2));
                if (lineColor.find()) item.put("stroke", "#" + lineColor.group(1).toUpperCase(Locale.US));
                long lineWidth = parseLong(attribute(line.group(1), "w"), 12700L);
                item.put("strokeWidth", Math.max(1, Math.min(8, lineWidth / 12700.0)));
            }
            Matcher rotation = ROTATION_PATTERN.matcher(block);
            String rotationAttrs = rotation.find() ? rotation.group(1) : "";
            if (rotationAttrs.isEmpty() && !inheritedBlock.isEmpty()) {
                Matcher inheritedRotation = ROTATION_PATTERN.matcher(inheritedBlock);
                if (inheritedRotation.find()) rotationAttrs = inheritedRotation.group(1);
            }
            if (!rotationAttrs.isEmpty()) item.put("rotation", parseLong(attribute(rotationAttrs, "rot"), 0L) / 60000.0);

            Matcher props = RUN_PROPS_PATTERN.matcher(block);
            String runProps = props.find() ? props.group(1) : "";
            if (runProps.isEmpty() && !inheritedBlock.isEmpty()) {
                Matcher inheritedProps = RUN_PROPS_PATTERN.matcher(inheritedBlock);
                if (inheritedProps.find()) runProps = inheritedProps.group(1);
            }
            if (!runProps.isEmpty()) {
                long size = parseLong(attribute(runProps, "sz"), 2200L);
                item.put("fontSize", Math.max(10, Math.min(72, size / 100.0)));
                item.put("bold", "1".equals(attribute(runProps, "b")));
                item.put("italic", "1".equals(attribute(runProps, "i")));
            }
            Matcher color = SOLID_COLOR_PATTERN.matcher(block);
            if (color.find()) item.put("color", "#" + color.group(1).toUpperCase(Locale.US));

            Matcher align = ALIGN_PATTERN.matcher(block);
            String alignment = align.find() ? align.group(1) : "";
            if (alignment.isEmpty() && !inheritedBlock.isEmpty()) {
                Matcher inheritedAlign = ALIGN_PATTERN.matcher(inheritedBlock);
                if (inheritedAlign.find()) alignment = inheritedAlign.group(1);
            }
            if (!alignment.isEmpty()) item.put("align", normalizeAlign(alignment));
            elements.put(item);
        }

        Matcher pictureMatcher = PICTURE_PATTERN.matcher(xml);
        while (pictureMatcher.find()) {
            String block = pictureMatcher.group(1);
            Matcher embed = EMBED_PATTERN.matcher(block);
            if (!embed.find()) continue;
            String imagePath = relationships.get(embed.group(1));
            byte[] imageBytes = imagePath == null ? null : entries.get(imagePath);
            if (imageBytes == null || imageBytes.length == 0 || imageBytes.length > MAX_IMAGE_BYTES) continue;
            if (totalImageBytes[0] + imageBytes.length > MAX_TOTAL_IMAGE_BYTES) continue;
            totalImageBytes[0] += imageBytes.length;
            JSObject item = positionObject("image", readBox(block), slideWidth, slideHeight);
            item.put("src", toDataUrl(imagePath, imageBytes));
            elements.put(item);
        }
        return elements;
    }

    private String extractBackground(byte[] xmlBytes, byte[] layoutBytes) {
        String direct = extractBackgroundColor(xmlBytes);
        if (!direct.isEmpty()) return direct;
        String inherited = extractBackgroundColor(layoutBytes);
        return inherited.isEmpty() ? "#FFFFFF" : inherited;
    }

    private String extractBackgroundColor(byte[] xmlBytes) {
        if (xmlBytes == null) return "";
        String xml = new String(xmlBytes, StandardCharsets.UTF_8);
        Matcher background = BACKGROUND_PATTERN.matcher(xml);
        if (!background.find()) return "";
        Matcher color = SOLID_COLOR_PATTERN.matcher(background.group(1));
        if (!color.find()) return "";
        return "#" + color.group(1).toUpperCase(Locale.US);
    }

    private JSObject positionObject(String type, long[] box, long slideWidth, long slideHeight) throws JSONException {
        JSObject item = new JSObject();
        item.put("type", type);
        item.put("x", pct(box[0], slideWidth));
        item.put("y", pct(box[1], slideHeight));
        item.put("w", pct(Math.max(1, box[2]), slideWidth));
        item.put("h", pct(Math.max(1, box[3]), slideHeight));
        return item;
    }

    private long[] readBox(String block) {
        return readBox(block, "");
    }

    private long[] readBox(String block, String inheritedBlock) {
        Matcher offset = OFFSET_PATTERN.matcher(block);
        Matcher extent = EXTENT_PATTERN.matcher(block);
        boolean hasOffset = offset.find();
        boolean hasExtent = extent.find();
        if ((!hasOffset || !hasExtent) && inheritedBlock != null && !inheritedBlock.isEmpty()) {
            Matcher inheritedOffset = OFFSET_PATTERN.matcher(inheritedBlock);
            Matcher inheritedExtent = EXTENT_PATTERN.matcher(inheritedBlock);
            if (!hasOffset && inheritedOffset.find()) { offset = inheritedOffset; hasOffset = true; }
            if (!hasExtent && inheritedExtent.find()) { extent = inheritedExtent; hasExtent = true; }
        }
        long x = 0, y = 0, w = DEFAULT_SLIDE_CX, h = DEFAULT_SLIDE_CY;
        if (hasOffset) { x = parseLong(offset.group(1), 0); y = parseLong(offset.group(2), 0); }
        if (hasExtent) { w = parseLong(extent.group(1), DEFAULT_SLIDE_CX); h = parseLong(extent.group(2), DEFAULT_SLIDE_CY); }
        return new long[] { x, y, w, h };
    }

    private Map<String, String> extractPlaceholderBlocks(byte[] xmlBytes) {
        Map<String, String> output = new HashMap<>();
        if (xmlBytes == null) return output;
        Matcher shapes = SHAPE_PATTERN.matcher(new String(xmlBytes, StandardCharsets.UTF_8));
        while (shapes.find()) {
            String block = shapes.group(1);
            String key = placeholderKey(block);
            if (!key.isEmpty()) output.put(key, block);
        }
        return output;
    }

    private String placeholderKey(String block) {
        if (block == null || block.isEmpty()) return "";
        Matcher placeholder = PLACEHOLDER_PATTERN.matcher(block);
        if (!placeholder.find()) return "";
        String attrs = placeholder.group(1);
        String index = attribute(attrs, "idx");
        if (!index.isEmpty()) return "idx:" + index;
        String type = attribute(attrs, "type");
        return type.isEmpty() ? "type:body" : "type:" + type;
    }

    private String extractRelationshipTarget(byte[] relBytes, String sourcePath, String typeSuffix) {
        if (relBytes == null) return "";
        Matcher matcher = RELATIONSHIP_PATTERN.matcher(new String(relBytes, StandardCharsets.UTF_8));
        while (matcher.find()) {
            String attrs = matcher.group(1);
            String target = unescapeXml(attribute(attrs, "Target"));
            String type = attribute(attrs, "Type");
            if (target.isEmpty() || !type.contains(typeSuffix)) continue;
            String base = sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1);
            return normalizePath(base + target);
        }
        return "";
    }

    private Map<String, String> extractRelationships(byte[] relBytes, String slidePath) {
        Map<String, String> result = new LinkedHashMap<>();
        if (relBytes == null) return result;
        String xml = new String(relBytes, StandardCharsets.UTF_8);
        Matcher matcher = RELATIONSHIP_PATTERN.matcher(xml);
        while (matcher.find()) {
            String attrs = matcher.group(1);
            String id = attribute(attrs, "Id");
            String target = unescapeXml(attribute(attrs, "Target"));
            String type = attribute(attrs, "Type");
            if (id.isEmpty() || target.isEmpty() || !type.contains("/image")) continue;
            String base = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
            result.put(id, normalizePath(base + target));
        }
        return result;
    }

    private JSArray extractTexts(byte[] xmlBytes) throws JSONException {
        JSArray texts = new JSArray();
        if (xmlBytes == null) return texts;
        String xml = new String(xmlBytes, StandardCharsets.UTF_8);
        Matcher matcher = TEXT_PATTERN.matcher(xml);
        while (matcher.find()) {
            String text = unescapeXml(matcher.group(1)).trim();
            if (!text.isEmpty()) texts.put(text);
        }
        return texts;
    }

    private String joinTexts(String block) {
        List<String> parts = new ArrayList<>();
        Matcher matcher = TEXT_PATTERN.matcher(block);
        while (matcher.find()) {
            String text = unescapeXml(matcher.group(1)).trim();
            if (!text.isEmpty()) parts.add(text);
        }
        return joinStrings(parts, " ").trim();
    }

    private String joinStrings(List<String> values, String delimiter) {
        StringBuilder builder = new StringBuilder();
        for (String value : values) {
            if (builder.length() > 0) builder.append(delimiter);
            builder.append(value);
        }
        return builder.toString();
    }

    private String attribute(String attrs, String name) {
        if (attrs == null) return "";
        Matcher matcher = Pattern.compile("(?:^|\\s)" + Pattern.quote(name) + "=\"([^\"]*)\"", Pattern.CASE_INSENSITIVE).matcher(attrs);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String normalizeAlign(String value) {
        String lower = String.valueOf(value).toLowerCase(Locale.US);
        if ("ctr".equals(lower) || "center".equals(lower)) return "center";
        if ("r".equals(lower) || "right".equals(lower)) return "right";
        return "left";
    }

    private String normalizeShapeKind(String value) {
        String lower = String.valueOf(value).toLowerCase(Locale.US);
        if (lower.contains("ellipse") || lower.contains("arc")) return "ellipse";
        if (lower.contains("triangle")) return "triangle";
        if (lower.contains("line") || lower.contains("connector")) return "line";
        if (lower.contains("round")) return "roundRect";
        return "rect";
    }

    private double pct(long value, long total) {
        if (total <= 0) return 0;
        return Math.max(0, Math.min(100, (value * 100.0) / total));
    }

    private long parseLong(String value, long fallback) {
        try { return Long.parseLong(String.valueOf(value)); } catch (Exception ignored) { return fallback; }
    }

    private String toDataUrl(String path, byte[] bytes) {
        return "data:" + imageMime(path) + ";base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
    }

    private String normalizePath(String raw) {
        String[] parts = raw.replace('\\', '/').split("/");
        List<String> normalized = new ArrayList<>();
        for (String part : parts) {
            if (part.isEmpty() || ".".equals(part)) continue;
            if ("..".equals(part)) {
                if (!normalized.isEmpty()) normalized.remove(normalized.size() - 1);
            } else normalized.add(part);
        }
        return joinStrings(normalized, "/");
    }

    private String imageMime(String path) {
        String lower = String.valueOf(path).toLowerCase(Locale.US);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".bmp")) return "image/bmp";
        return "application/octet-stream";
    }

    private File resolveStagedAsset(String path) throws Exception {
        File directory = new File(getContext().getCacheDir(), "native-assets").getCanonicalFile();
        File target = new File(path).getCanonicalFile();
        if (!target.getPath().startsWith(directory.getPath() + File.separator)) {
            throw new SecurityException("PowerPoint asset path is outside the app cache.");
        }
        return target;
    }

    private String unescapeXml(String value) {
        return String.valueOf(value)
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&amp;", "&");
    }

    private static final class SlideEntry {
        final String path;
        final int number;
        SlideEntry(String path, int number) { this.path = path; this.number = number; }
    }
}
