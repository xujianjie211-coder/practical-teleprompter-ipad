#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IPAD_DIR="$ROOT_DIR/ipad"
BUILD_DIR="$IPAD_DIR/build"
OUTPUT_DIR="$ROOT_DIR/output"

rm -rf "$BUILD_DIR" "$OUTPUT_DIR"
mkdir -p "$BUILD_DIR" "$OUTPUT_DIR/Payload"

xcodegen generate --spec "$IPAD_DIR/project.yml" --project "$IPAD_DIR"

xcodebuild \
  -project "$IPAD_DIR/PracticalTeleprompter.xcodeproj" \
  -scheme PracticalTeleprompter \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

APP_PATH="$BUILD_DIR/DerivedData/Build/Products/Release-iphoneos/PracticalTeleprompter.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "App build not found: $APP_PATH" >&2
  exit 1
fi

cp -R "$APP_PATH" "$OUTPUT_DIR/Payload/"
cd "$OUTPUT_DIR"
/usr/bin/zip -qry "PracticalTeleprompter-unsigned.ipa" Payload
rm -rf Payload

echo "IPA created: $OUTPUT_DIR/PracticalTeleprompter-unsigned.ipa"
