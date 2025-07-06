import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.shaytech.groceries',
  appName: 'Specifically Clementines',
  plugins:  {
    CapacitorCookies: { enabled: true},
    CapacitorHttp: { enabled: true},
    // Keyboard: {
    //   resizeOnFullScreen: true
    // },
  },
  webDir: 'build',
  android: {
  //   captureInput: true,
  //   useLegacyBridge: true
   },
};

export default config;
