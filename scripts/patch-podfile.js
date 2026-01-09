#!/usr/bin/env node

/**
 * Patch Podfile to ensure RCT-Folly is available
 * This script runs after prebuild to fix CocoaPods dependency issues
 */

const fs = require('fs');
const path = require('path');

const podfilePath = path.join(__dirname, '..', 'ios', 'Podfile');

if (!fs.existsSync(podfilePath)) {
  console.log('⚠️  Podfile not found, skipping patch');
  process.exit(0);
}

try {
  let podfileContent = fs.readFileSync(podfilePath, 'utf8');
  let modified = false;

  // Ensure the React Native source is included
  if (!podfileContent.includes("source 'https://cdn.cocoapods.org/'")) {
    // Add source at the top if not present
    podfileContent = `source 'https://cdn.cocoapods.org/'\n` + podfileContent;
    modified = true;
  }

  // Add post_install hook to update CocoaPods repo if not present
  if (!podfileContent.includes('post_install do |installer|')) {
    const postInstallHook = `
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
      end
    end
  end
`;

    // Add before the last 'end'
    const lastEndIndex = podfileContent.lastIndexOf('end');
    if (lastEndIndex > 0) {
      podfileContent = podfileContent.slice(0, lastEndIndex) + postInstallHook + '\nend';
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(podfilePath, podfileContent, 'utf8');
    console.log('✅ Patched Podfile');
  } else {
    console.log('✅ Podfile already configured');
  }
} catch (error) {
  console.warn('⚠️  Failed to patch Podfile:', error.message);
  process.exit(0); // Don't fail the build
}

