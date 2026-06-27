const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFmtPodfileFix(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
            let contents = fs.readFileSync(podfilePath, 'utf-8');

            if (contents.includes('apple_build_version__) \\n')) {
                return config;
            }

            // Fix: fmt 11.0.2 miscompiles with Xcode 26 (Apple Clang 21+)
            // Widen the Apple Clang guard so ALL apple_clang uses constexpr fallback
            // See: https://github.com/software-mansion/react-native-reanimated/pull/9679
            const fmtFix = `
    fmt_base_h = "#{installer.sandbox.root}/fmt/include/fmt/base.h"
    if File.exist?(fmt_base_h)
      content = File.read(fmt_base_h)
      old_guard = "#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L"
      new_guard = "#elif defined(__apple_build_version__)"
      if content.include?(old_guard)
        File.write(fmt_base_h, content.gsub(old_guard, new_guard))
        puts "✅ Patched fmt/base.h for Xcode 26 (Apple Clang 21+) compatibility"
      end
    end`;

            if (contents.includes('post_install do |installer|')) {
                contents = contents.replace(
                    /post_install do \|installer\|/,
                    `post_install do |installer|${fmtFix}`
                );
            } else {
                contents += `\npost_install do |installer|${fmtFix}\nend\n`;
            }

            fs.writeFileSync(podfilePath, contents);
            return config;
        },
    ]);
};
