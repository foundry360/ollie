#!/bin/bash
# EAS Build Hooks
# This script runs before pod install to ensure CocoaPods repo is updated

set -e

echo "🔧 Updating CocoaPods repository..."
pod repo update trunk || echo "⚠️  Warning: pod repo update failed, continuing anyway"

echo "✅ CocoaPods repository update complete"

