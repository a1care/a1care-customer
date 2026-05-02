const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

/**
 * Adds $RNFirebaseAsStaticFramework = true to the Podfile.
 * This is the official fix for Firebase Swift pods failing with static frameworks.
 * See: https://rnfirebase.io/#expo
 */
const withFirebaseStaticFramework = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf-8');

      const modified = mergeContents({
        tag: 'rn-firebase-static-framework',
        src: contents,
        newSrc: '$RNFirebaseAsStaticFramework = true',
        anchor: /^/,
        offset: 0,
        comment: '#',
      });

      fs.writeFileSync(podfilePath, modified.contents);
      return config;
    },
  ]);
};

module.exports = withFirebaseStaticFramework;
