import { WebPlugin } from '@capacitor/core';
import type { SafeAreaPlugin } from './definitions';

export class SafeAreaWeb extends WebPlugin implements SafeAreaPlugin {
  constructor() {
    super();
  }
  async initialize(): Promise<void> {
      return;
  }
  async changeSystemBarsIconsAppearance(options: {isLight: boolean}): Promise<void> {
      console.debug("Changing system bars appearance on web:",options);
      return;
  }

}
