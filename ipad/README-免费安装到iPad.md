# 实用提词器：免费安装为真正的 iPad App

这不是“添加到主屏幕”的网页快捷方式。构建后的 `PracticalTeleprompter-unsigned.ipa` 是一个真正的 iPad 应用安装包，网页资源全部内置，安装并签名有效时可完全离线使用。

## 需要准备

- 一台 Windows 电脑
- iPad 和数据线（第一次安装 SideStore 时使用）
- 一个普通的免费 Apple Account
- 一个 GitHub 账号

建议为侧载单独注册一个 Apple Account，不要使用保存大量私人资料或付款信息的主账号。

## 第一步：免费生成 IPA

### 1. 创建 GitHub 仓库

1. 登录 GitHub，创建一个新仓库。
2. 如果希望始终免费使用 GitHub 的 macOS 构建资源，请创建公开仓库。公开仓库意味着项目源代码可以被别人看到，但不会包含你的 Apple Account、文稿或 iPad 数据。
3. 把“提词器-iPad免费构建包.zip”解压后的全部内容上传到仓库根目录。

上传后，仓库根目录应能看到：

```text
.github/workflows/build-ipad-ipa.yml
ipad/
web/
```

### 2. 运行构建

1. 打开仓库的 **Actions** 页面。
2. 左侧点击 **构建 iPad IPA**。
3. 点击右侧 **Run workflow**，再次点击绿色按钮确认。
4. 等待任务显示绿色对勾。
5. 打开该次任务，在页面底部的 **Artifacts** 下载 `PracticalTeleprompter-iPad-IPA`。
6. 解压后得到 `PracticalTeleprompter-unsigned.ipa`。

这个 IPA 没有包含任何 Apple Account 或签名。SideStore 安装时会在你的设备上用你的免费账号重新签名。

## 第二步：在 Windows 上安装 SideStore

SideStore 的安装方式可能随 iPadOS 更新而变化，请以 SideStore 官方安装页为准：

- https://docs.sidestore.io/docs/installation/prerequisites
- https://docs.sidestore.io/docs/installation/install

当前基本流程：

1. 在 Windows 安装 SideStore 官方说明要求的组件和 iLoader。
2. 用数据线连接并解锁 iPad，点击“信任此电脑”。
3. 在 iLoader 中登录用于侧载的 Apple Account，并将 SideStore 安装到 iPad。
4. iPad 打开 **设置 → 通用 → VPN 与设备管理**，信任该开发者应用。
5. iPad 打开 **设置 → 隐私与安全性 → 开发者模式**，开启后按提示重启。
6. 按 SideStore 官方说明安装并连接 LocalDevVPN。
7. 打开 SideStore，先刷新 SideStore 自身，确认剩余时间重新变为 7 DAYS。

## 第三步：安装提词器 IPA

1. 把 `PracticalTeleprompter-unsigned.ipa` 保存到 iPad“文件”App，或通过局域网、网盘传入。
2. 打开 SideStore，进入 **My Apps**。
3. 点击左上角 `+`，选择该 IPA。
4. 等待 SideStore 完成签名和安装。
5. 回到 iPad 主屏幕，打开“实用提词器”。

安装后的 App 不依赖网站，文稿保存在 App 本机数据中。删除 App 通常也会删除文稿，请定期通过“导出 TXT”备份重要内容。

## 每 7 天续签

免费 Apple Account 的签名有效期为 7 天。建议每 5～6 天操作一次：

1. 让 iPad 连接互联网和 Wi-Fi。
2. 开启 SideStore 所需的 LocalDevVPN。
3. 打开 SideStore → **My Apps**。
4. 点击 **Refresh All**，或分别刷新 SideStore 和“实用提词器”。
5. 确认两者重新显示接近 `7 DAYS`。

续签不等于重装，正常情况下不会清除提词器里的文稿。

## 常见问题

### App 突然打不开

一般是超过 7 天没有刷新。重新用 SideStore 签名安装即可。如果没有主动删除原 App，数据有机会保留，但无法保证，所以重要文稿一定要导出备份。

### SideStore 刷新失败

先确认 Wi-Fi、LocalDevVPN 和 SideStore 登录状态。iPadOS 更新后配对文件可能失效，此时需要根据官方说明重新生成配对文件或用数据线重新安装 SideStore。

### 能否永久免费且不续签

正常、可信且无需越狱的免费个人侧载无法绕过 Apple 的 7 天限制。不要安装来源不明的“企业证书永久免签”包。

### 完全断网能用多久

提词器本身不需要网络，但免费签名仍会按时间过期。签名有效的 7 天内完全离线可用；续签时需要联网。
