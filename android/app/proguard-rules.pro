# Keep Capacitor plugin entry points and annotations used through reflection.
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.mobdea.education.security.** { *; }
-keep class com.mobdea.education.update.** { *; }
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault

# Preserve useful release crash diagnostics without exposing source file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
