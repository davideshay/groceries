export interface SafeAreaPlugin {
    changeSystemBarsIconsAppearance(options: {isLight: boolean}): Promise<void>
    initialize(): Promise<void>
}