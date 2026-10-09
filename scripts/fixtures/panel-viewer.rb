cask "panel-viewer" do
  version "0.2.12"
  sha256 "1b72f1f8c2ce8071b6fc8d78d21aab302f91053559de72bd9a3e3f10027908b0"

  url "https://github.com/gyuha/panel-viewer/releases/download/v#{version}/Panel.Viewer_#{version}_aarch64.dmg"
  name "Panel Viewer"
  desc "만화·웹툰 뷰어"
  homepage "https://github.com/gyuha/panel-viewer"

  depends_on arch: :arm64

  app "Panel Viewer.app"

  # 공식 서명·공증을 거치지 않은 앱이다. 이 앱에 한해서만 격리를 해제한다.
  postflight_steps do
    run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{appdir}}/Panel Viewer.app"]
  end
end
