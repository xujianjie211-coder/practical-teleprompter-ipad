import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled `web` directory through a stable app:// URL.
/// A stable origin allows WebKit localStorage to survive ordinary launches and updates.
final class BundledWebSchemeHandler: NSObject, WKURLSchemeHandler {
    private let rootURL: URL

    override init() {
        guard let resourceURL = Bundle.main.resourceURL else {
            fatalError("Application resource directory is unavailable")
        }
        rootURL = resourceURL.appendingPathComponent("web", isDirectory: true).standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            fail(urlSchemeTask, code: .badURL)
            return
        }

        var relativePath = requestURL.path.removingPercentEncoding ?? requestURL.path
        relativePath = relativePath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if relativePath.isEmpty { relativePath = "index.html" }

        let fileURL = rootURL.appendingPathComponent(relativePath).standardizedFileURL
        guard fileURL.path.hasPrefix(rootURL.path + "/"),
              FileManager.default.fileExists(atPath: fileURL.path) else {
            fail(urlSchemeTask, code: .fileDoesNotExist)
            return
        }

        do {
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            let response = URLResponse(
                url: requestURL,
                mimeType: mimeType(for: fileURL),
                expectedContentLength: data.count,
                textEncodingName: isTextFile(fileURL) ? "utf-8" : nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func fail(_ task: WKURLSchemeTask, code: URLError.Code) {
        task.didFailWithError(URLError(code))
    }

    private func mimeType(for url: URL) -> String {
        if let type = UTType(filenameExtension: url.pathExtension),
           let mimeType = type.preferredMIMEType {
            return mimeType
        }
        return "application/octet-stream"
    }

    private func isTextFile(_ url: URL) -> Bool {
        ["html", "css", "js", "json", "webmanifest", "svg", "txt"].contains(url.pathExtension.lowercased())
    }
}
