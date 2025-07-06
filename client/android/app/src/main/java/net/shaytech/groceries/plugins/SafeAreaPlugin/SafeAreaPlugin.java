package net.shaytech.groceries.plugins.SafeAreaPlugin;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin
public class SafeAreaPlugin extends Plugin {
    private WindowInsetsCompat windowInsets;

    @Override
    public void load() {
        super.load();

         ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (v, windowInsets) -> {
             SafeAreaPlugin.this.windowInsets = windowInsets;
             applyInsets(windowInsets);
             return WindowInsetsCompat.CONSUMED;
         });

//        changeSystemBarsIconsAppearance(true);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (windowInsets != null) {
            applyInsets(windowInsets);
        }

        call.resolve();
    }

    /**
     * When targeting Android API 35, edge-to-edge handling is enforced. We want
     * to use edge-to-edge layout on devices > API 35, but have to preserve
     * layout margins on older devices - otherwise part of the content is cut
     * off (hidden behind the status bar).
     * Thus, we use `adjustMarginsForEdgeToEdge: 'disable'` and manually handle
     * the case for devices < API 35
     * open issue:7951
     */
    private void applyInsets(WindowInsetsCompat windowInsets) {
        // For devices < API 35, we apply layout margins --> safe-area-insets will be 0
        final int systemBarsType = WindowInsetsCompat.Type.systemBars();
        final int displayCutoutType = WindowInsetsCompat.Type.displayCutout();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            final androidx.core.graphics.Insets insets = windowInsets.getInsets(systemBarsType | displayCutoutType);

            getBridge().getActivity().runOnUiThread(() -> {
                ViewGroup.MarginLayoutParams layoutParams = (ViewGroup.MarginLayoutParams) getBridge().getWebView().getLayoutParams();
                layoutParams.bottomMargin = insets.bottom;
                layoutParams.topMargin = insets.top;
                layoutParams.rightMargin = insets.right;
                layoutParams.leftMargin = insets.left;
                getBridge().getWebView().setLayoutParams(layoutParams);
            });
        } else {
            final int imeType = WindowInsetsCompat.Type.ime();
            final androidx.core.graphics.Insets insets = windowInsets.getInsets(systemBarsType | displayCutoutType | imeType);

            // For devices with API 35 we manually set safe-area inset variables. There is a current issue with the WebView
            // (see https://chromium-review.googlesource.com/c/chromium/src/+/6295663/comments/a5fc2d65_86c53b45?tab=comments)
            // which causes safe-area-insets to not respect system bars.
            // Code based on https://ruoyusun.com/2020/10/21/webview-fullscreen-notch.html
            final float density = getBridge().getActivity().getApplicationContext().getResources().getDisplayMetrics().density;

            final int top = Math.round(insets.top / density);
            final int right = Math.round(insets.right / density);
            final int bottom = Math.round(insets.bottom / density);
            final int left = Math.round(insets.left / density);

            getBridge().getActivity().runOnUiThread(() -> {
                String javascript =
                    "(function() {" +
                    "  function setSafeAreaInsets() {" +
                    "    var root = document.documentElement || document.querySelector('html');" +
                    "    if (root) {" +
                    "      root.style.setProperty('--android-safe-area-top', 'max(env(safe-area-inset-top), " + top + "px)');" +
                    "      root.style.setProperty('--android-safe-area-right', 'max(env(safe-area-inset-right), " + right + "px)');" +
                    "      root.style.setProperty('--android-safe-area-bottom', 'max(env(safe-area-inset-bottom), " + bottom + "px)');" +
                    "      root.style.setProperty('--android-safe-area-left', 'max(env(safe-area-inset-left), " + left + "px)');" +
                    "      console.log('Safe area insets set: top=" + top + ", right=" + right + ", bottom=" + bottom + ", left=" + left + "');" +
                    "      return true;" +
                    "    } else {" +
                    "      console.error('Could not find document.documentElement or html element');" +
                    "      return false;" +
                    "    }" +
                    "  }" +
                    "  if (document.readyState === 'loading') {" +
                    "    document.addEventListener('DOMContentLoaded', setSafeAreaInsets);" +
                    "  } else {" +
                    "    setSafeAreaInsets();" +
                    "  }" +
                    "})();";

                getBridge().getWebView().loadUrl("javascript:" + javascript);
            });
        }
    }

    @PluginMethod
    public void changeSystemBarsIconsAppearance(PluginCall call) {
        Boolean isLight = call.getBoolean("isLight",false);
        changeSystemBarsIconsAppearanceLocal(isLight);
        call.resolve();
    }

    public void changeSystemBarsIconsAppearanceLocal(Boolean isLight) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                
                Log.d("SystemBars", "Setting system bars appearance, isLight: " + isLight + ", API: " + Build.VERSION.SDK_INT);
                
                if (Build.VERSION.SDK_INT == Build.VERSION_CODES.TIRAMISU) {
                    // Special handling for API 33 - avoid transparent colors
                    handleAPI33SystemBars(window, isLight);
                } else {
                    // API 30-32 and 34+ - use WindowInsetsController with transparent bars
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        if (isLight) {
                            controller.setSystemBarsAppearance(
                                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                        } else {
                            controller.setSystemBarsAppearance(
                                    0,
                                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                        }
                        window.getDecorView().requestApplyInsets();
                        Log.d("SystemBars", "WindowInsetsController updated successfully");
                    } else {
                        Log.e("SystemBars", "WindowInsetsController is null");
                    }
                }
                
            } catch (Exception e) {
                Log.e("SystemBars", "Error changing system bars appearance", e);
            }
        });
    }

    private void handleAPI33SystemBars(Window window, Boolean isLight) {
        if (Build.VERSION.SDK_INT != Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        try {
            // For API 33, set explicit colors instead of transparent to avoid the overlay bug
            if (isLight) {
                // Light mode: white/light gray bars with dark icons
                window.setStatusBarColor(Color.parseColor("#FAFAFA")); // Light gray
                window.setNavigationBarColor(Color.parseColor("#FFFFFF")); // Light gray
            } else {
                // Dark mode: dark bars with light icons
                window.setStatusBarColor(Color.parseColor("#202020")); // Dark gray
                window.setNavigationBarColor(Color.parseColor("#000000")); // Dark gray
            }
            
            // Now set icon appearance using both methods for reliability
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                if (isLight) {
                    controller.setSystemBarsAppearance(
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                } else {
                    controller.setSystemBarsAppearance(
                            0,
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                }
            }
            
            // Backup with deprecated flags for API 33
            View decorView = window.getDecorView();
            int flags = decorView.getSystemUiVisibility();
            
            if (isLight) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            } else {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            
            decorView.setSystemUiVisibility(flags);
            
            Log.d("SystemBars", "API 33 with explicit colors applied");
            
        } catch (Exception e) {
            Log.e("SystemBars", "Error in API 33 system bars handling", e);
        }
    }    

}