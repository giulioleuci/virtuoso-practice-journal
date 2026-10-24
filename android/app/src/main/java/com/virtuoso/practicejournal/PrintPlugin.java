package com.virtuoso.practicejournal;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {
    // Strong reference: the print job renders from this WebView after printHtml returns.
    private WebView printView;

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.isEmpty()) {
            call.reject("html is required");
            return;
        }
        String name = call.getString("name", "Virtuoso");
        getActivity().runOnUiThread(() -> {
            WebView view = new WebView(getContext());
            view.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView v, String url) {
                    PrintManager pm = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                    if (pm == null) {
                        call.reject("printing is not available");
                        return;
                    }
                    pm.print(name, v.createPrintDocumentAdapter(name),
                            new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                    call.resolve();
                }
            });
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            printView = view;
        });
    }
}
