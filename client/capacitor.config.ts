import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.shaytech.groceries',
  appName: 'Specifically Clementines',
  plugins:  {
    CapacitorCookies: { enabled: true},
    CapacitorHttp: { enabled: true},
    SafeArea: {
      enabled: true,
      customColorsForSystemBars: true,
      statusBarColor: '#000000',
      statusBarContent: 'light',
      navigationBarColor: '#000000',
      navigationBarContent: 'light',
      offset: 0,
    },
  },
  webDir: 'build',
   android: {
  //   captureInput: true,
  //   useLegacyBridge: true
   },
};

export default config;
