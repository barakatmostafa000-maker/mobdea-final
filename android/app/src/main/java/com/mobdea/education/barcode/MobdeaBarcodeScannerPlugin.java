package com.mobdea.education.barcode;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

@CapacitorPlugin(name = "MobdeaBarcodeScanner")
public class MobdeaBarcodeScannerPlugin extends Plugin {
    private static final String PROJECT13_NATIVE_BARCODE_SCANNER_V1 = "PROJECT13_NATIVE_BARCODE_SCANNER_V1";

    @PluginMethod
    public void scan(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                    .setBarcodeFormats(
                            Barcode.FORMAT_QR_CODE,
                            Barcode.FORMAT_CODE_128,
                            Barcode.FORMAT_CODE_39
                    )
                    .enableAutoZoom()
                    .build();
            GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(getActivity(), options);
            Task<Barcode> task = scanner.startScan();
            task.addOnSuccessListener(barcode -> {
                JSObject result = new JSObject();
                result.put("project", PROJECT13_NATIVE_BARCODE_SCANNER_V1);
                result.put("cancelled", false);
                result.put("rawValue", barcode.getRawValue() == null ? "" : barcode.getRawValue());
                result.put("displayValue", barcode.getDisplayValue() == null ? "" : barcode.getDisplayValue());
                result.put("format", barcode.getFormat());
                call.resolve(result);
            });
            task.addOnCanceledListener(() -> {
                JSObject result = new JSObject();
                result.put("project", PROJECT13_NATIVE_BARCODE_SCANNER_V1);
                result.put("cancelled", true);
                result.put("rawValue", "");
                call.resolve(result);
            });
            task.addOnFailureListener(error -> call.reject(
                    error.getMessage() == null ? "Barcode scan failed." : error.getMessage()
            ));
        });
    }
}
