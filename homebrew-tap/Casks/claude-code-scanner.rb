cask "claude-code-scanner" do
  version "0.1.0"

  if Hardware::CPU.arm?
    url "https://github.com/OWNER/claude-code-scanner/releases/download/v#{version}/Claude-Code-Scanner-#{version}-arm64.dmg"
    sha256 "PLACEHOLDER_ARM64_SHA256"
  else
    url "https://github.com/OWNER/claude-code-scanner/releases/download/v#{version}/Claude-Code-Scanner-#{version}-x64.dmg"
    sha256 "PLACEHOLDER_X64_SHA256"
  end

  name "Claude Code Scanner"
  desc "Claude Code API Traffic Scanner & Analyzer"
  homepage "https://github.com/OWNER/claude-code-scanner"

  depends_on cask: "docker"

  app "Claude Code Scanner.app"

  zap trash: [
    "~/Library/Application Support/claude-code-scanner",
    "~/Library/Preferences/com.claude-code-scanner.app.plist",
    "~/Library/Logs/claude-code-scanner",
  ]
end
