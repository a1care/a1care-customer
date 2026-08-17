const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withExtractNativeLibs(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    if (androidManifest && androidManifest.application && androidManifest.application[0]) {
      const app = androidManifest.application[0];
      app.$['android:extractNativeLibs'] = "true";
    }
    return config;
  });
};
