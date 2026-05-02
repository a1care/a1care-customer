const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * 1. Adds $RNFirebaseAsStaticFramework = true to the Podfile.
 * 2. Injects CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = 'YES' into all targets.
 * This is the ultimate fix for Firebase + static framework build errors in Expo.
 */
const withFirebaseStaticFramework = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Add the global flag for Firebase
      if (!contents.includes('$RNFirebaseAsStaticFramework = true')) {
        contents = '$RNFirebaseAsStaticFramework = true\n' + contents;
      }

      // Add the post_install hook to allow non-modular headers
      const postInstallMatch = contents.match(/post_install do \|installer\|/);
      
      const buildSettingInclusion = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

      if (postInstallMatch) {
        // If post_install already exists, inject into it
        if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
          contents = contents.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|${buildSettingInclusion}`
          );
        }
      } else {
        // If no post_install, add it at the end
        contents += `\npost_install do |installer|${buildSettingInclusion}\nend\n`;
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withFirebaseStaticFramework;
