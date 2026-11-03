// Renders every page of a PDF to PNG (macOS PDFKit) — used by bake-blueprints.mjs.
// usage: swift scripts/pdf-pages.swift <file.pdf> <outDir> <prefix> <widthPx>
import AppKit
import PDFKit

let args = CommandLine.arguments
guard args.count == 5, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])), let width = Double(args[4]) else {
  FileHandle.standardError.write("usage: pdf-pages.swift <file.pdf> <outDir> <prefix> <widthPx>\n".data(using: .utf8)!)
  exit(1)
}
for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let box = page.bounds(for: .mediaBox)
  let scale = width / box.width
  let size = NSSize(width: box.width * scale, height: box.height * scale)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  let ctx = NSGraphicsContext(bitmapImageRep: rep)!
  NSGraphicsContext.current = ctx
  NSColor.white.setFill()
  NSRect(origin: .zero, size: size).fill()
  ctx.cgContext.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx.cgContext)
  NSGraphicsContext.restoreGraphicsState()
  let out = URL(fileURLWithPath: args[2]).appendingPathComponent(String(format: "%@-%02d.png", args[3], i + 1))
  try! rep.representation(using: .png, properties: [:])!.write(to: out)
}
print("\(args[3]): \(doc.pageCount) pages")
