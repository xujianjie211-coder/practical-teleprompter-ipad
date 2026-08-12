# iPad 原生封装说明

- `Sources/AppDelegate.swift`：创建全屏 iPad 应用窗口。
- `Sources/TeleprompterViewController.swift`：承载 WKWebView，并提供常亮、TXT 导入和 TXT 导出原生桥接。
- `Sources/BundledWebSchemeHandler.swift`：从 App 包内部加载 `web` 资源，固定在 `teleprompter://app/` 域下。
- `Assets.xcassets`：iPad 主屏幕图标。
- `project.yml`：XcodeGen 工程定义，仅以 iPad 为目标设备。
- `build-ipa.sh`：在 macOS/Xcode 环境中生成未签名 IPA。
- `.github/workflows/build-ipad-ipa.yml`：GitHub Actions 一键构建入口。

应用不声明网络、相机、麦克风、照片或定位权限。网页文稿仍保存在 WebKit 的持久化 localStorage 中；TXT 导入导出通过系统文件选择器和分享面板完成。
