#!/usr/bin/env node

/**
 * Patch podspec files to comment out visionos references for CocoaPods compatibility
 * This script runs after npm install to ensure podspecs are compatible
 */

const fs = require('fs');
const path = require('path');

const podspecsToPatch = [
  'node_modules/react-native-safe-area-context/react-native-safe-area-context.podspec',
  'node_modules/react-native-svg/RNSVG.podspec',
  'node_modules/react-native/React/CoreModules/React-CoreModules.podspec',
];

podspecsToPatch.forEach(podspecPath => {
  const fullPath = path.join(__dirname, '..', podspecPath);
  
  if (!fs.existsSync(fullPath)) {
    return; // Skip if file doesn't exist
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Patch visionos.deployment_target
    if (content.includes('s.visionos.deployment_target')) {
      content = content.replace(
        /(\s*)s\.visionos\.deployment_target\s*=\s*["'][^"']+["']/g,
        '$1# s.visionos.deployment_target = "1.0"  # Commented for CocoaPods compatibility'
      );
      modified = true;
    }

    // Patch visionos.resource_bundles
    if (content.includes('s.visionos.resource_bundles')) {
      content = content.replace(
        /(\s*)s\.visionos\.resource_bundles\s*=\s*\{[^}]+\}/g,
        (match, indent) => {
          return match.replace(/s\.visionos\.resource_bundles/, '# s.visionos.resource_bundles  # Commented for CocoaPods compatibility');
        }
      );
      modified = true;
    }

    // Patch visionos.exclude_files
    if (content.includes('s.visionos.exclude_files')) {
      content = content.replace(
        /(\s*)s\.visionos\.exclude_files\s*=\s*[^\n]+/g,
        '$1# s.visionos.exclude_files = ...  # Commented for CocoaPods compatibility'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Patched ${podspecPath}`);
    }
  } catch (error) {
    console.warn(`⚠️  Failed to patch ${podspecPath}:`, error.message);
  }
});

console.log('✅ Podspec patching complete');



