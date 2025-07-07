import { registerPlugin } from '@capacitor/core';

import type { SafeAreaPlugin } from './definitions';

const SafeArea = registerPlugin<SafeAreaPlugin>('SafeAreaPlugin', {
    web: () => import("./web").then(m => new m.SafeAreaWeb())
});

export * from "./definitions";

export { SafeArea };