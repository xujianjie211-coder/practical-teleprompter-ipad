import UIKit
import UniformTypeIdentifiers
import WebKit

final class TeleprompterViewController: UIViewController, WKScriptMessageHandler, WKUIDelegate, UIDocumentPickerDelegate {
    private let schemeHandler = BundledWebSchemeHandler()
    private var webView: WKWebView!

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .all }

    override func loadView() {
        let contentController = WKUserContentController()
        contentController.add(self, name: "nativeApp")
        contentController.addUserScript(WKUserScript(
            source: "window.__TELEPROMPTER_NATIVE_APP__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController = contentController
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "teleprompter")
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let url = URL(string: "teleprompter://app/index.html") else { return }
        webView.load(URLRequest(url: url))
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "nativeApp")
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeApp",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "screenAwake":
            UIApplication.shared.isIdleTimerDisabled = body["enabled"] as? Bool ?? false
        case "importText":
            presentTextImporter()
        case "exportText":
            exportText(
                title: body["title"] as? String ?? "未命名文稿",
                content: body["content"] as? String ?? ""
            )
        case "copyText":
            UIPasteboard.general.string = body["content"] as? String ?? ""
            sendNativeResult(name: "copyText", success: true)
        default:
            break
        }
    }

    private func presentTextImporter() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        do {
            let data = try Data(contentsOf: url)
            let text = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .unicode)
                ?? String(decoding: data, as: UTF8.self)
            sendImportedText(title: url.deletingPathExtension().lastPathComponent, content: text)
        } catch {
            showAlert(title: "导入失败", message: error.localizedDescription)
        }
    }

    private func sendImportedText(title: String, content: String) {
        let payload: [String: String] = ["title": title, "content": content]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.receiveNativeText(\(json));")
    }

    private func sendNativeResult(name: String, success: Bool) {
        let safeName = name.replacingOccurrences(of: "'", with: "")
        webView.evaluateJavaScript("window.receiveNativeResult?.('\(safeName)', \(success ? "true" : "false"));")
    }

    private func exportText(title: String, content: String) {
        let invalidCharacters = CharacterSet(charactersIn: "\\/:*?\"<>|")
        let safeTitle = title.components(separatedBy: invalidCharacters).joined(separator: "_")
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(safeTitle.isEmpty ? "未命名文稿.txt" : "\(safeTitle).txt")
        do {
            guard let data = content.data(using: .utf8) else {
                throw CocoaError(.fileWriteInapplicableStringEncoding)
            }
            try data.write(to: fileURL, options: .atomic)
            let controller = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
            if let popover = controller.popoverPresentationController {
                popover.sourceView = view
                popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            }
            present(controller, animated: true)
        } catch {
            showAlert(title: "导出失败", message: error.localizedDescription)
        }
    }

    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default))
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url, navigationAction.targetFrame == nil {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = UIAlertController(title: "实用提词器", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = UIAlertController(title: "请确认", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "确定", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
