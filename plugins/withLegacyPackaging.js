const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withLegacyPackaging(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      if (!config.modResults.contents.includes('useLegacyPackaging = true')) {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*\{/,
          `android {
    packagingOptions {
        jniLibs {
            useLegacyPackaging = true
        }
    }`
        );
      }
    }
    return config;
  });
};
