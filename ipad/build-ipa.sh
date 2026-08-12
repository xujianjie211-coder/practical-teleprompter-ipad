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

# Xcode may regenerate Info.plist when building an unsigned app.  Normalize the
# final product itself so iPadOS never falls back to the framed compatibility
# presentation because launch-screen, orientation, or device-family metadata
# went missing during generation.
APP_INFO_PLIST="$APP_PATH/Info.plist"
APP_INFO_PLIST="$APP_INFO_PLIST" python3 <<'PY'
import os
import plistlib

path = os.environ["APP_INFO_PLIST"]
with open(path, "rb") as handle:
    info = plistlib.load(handle)

info.update({
    "CFBundleDevelopmentRegion": "zh_CN",
    "CFBundleDisplayName": "实用提词器",
    "CFBundleShortVersionString": "1.1.0",
    "CFBundleVersion": "2",
    "UIDeviceFamily": [2],
    "UILaunchScreen": {},
    "UISupportedInterfaceOrientations": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
    ],
    "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
    ],
    "UIStatusBarHidden": True,
    "UIViewControllerBasedStatusBarAppearance": True,
})

# On iPadOS 26 this deprecated compatibility flag can create a fixed-size
# scene surrounded by system background instead of a genuinely resizable,
# edge-to-edge full-screen window.
info.pop("UIRequiresFullScreen", None)

with open(path, "wb") as handle:
    plistlib.dump(info, handle, fmt=plistlib.FMT_BINARY, sort_keys=False)
PY

# Fail the build instead of publishing another compatibility-mode IPA.
APP_INFO_PLIST="$APP_INFO_PLIST" python3 <<'PY'
import os
import plistlib

with open(os.environ["APP_INFO_PLIST"], "rb") as handle:
    info = plistlib.load(handle)

expected_orientations = {
    "UIInterfaceOrientationPortrait",
    "UIInterfaceOrientationPortraitUpsideDown",
    "UIInterfaceOrientationLandscapeLeft",
    "UIInterfaceOrientationLandscapeRight",
}
assert info.get("CFBundleDisplayName") == "实用提词器"
assert info.get("UIDeviceFamily") == [2]
assert info.get("UILaunchScreen") == {}
assert set(info.get("UISupportedInterfaceOrientations~ipad", [])) == expected_orientations
assert "UIRequiresFullScreen" not in info
print("Verified native resizable iPad metadata")
PY

cp -R "$APP_PATH" "$OUTPUT_DIR/Payload/"
cd "$OUTPUT_DIR"
/usr/bin/zip -qry "PracticalTeleprompter-unsigned.ipa" Payload
rm -rf Payload

echo "IPA created: $OUTPUT_DIR/PracticalTeleprompter-unsigned.ipa"
