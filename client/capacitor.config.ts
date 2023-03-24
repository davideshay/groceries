import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.shaytech.groceries',
  appName: 'groceries',
  plugins:  {
    CapacitorCookies: { enabled: true},
    CapacitorHttp: { enabled: true}
  },
  webDir: 'build',
  bundledWebRuntime: false,
  // android: {
  //   captureInput: true,
  //   useLegacyBridge: true
  // },
};

export default config;
