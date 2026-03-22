cask "claude-code-scanner" do
  version "0.1.2"

  if Hardware::CPU.arm?
    url "https://github.com/ash-hun/claude-code-scanner/releases/download/v#{version}/Claude-Code-Scanner-#{version}-arm64.dmg"
    sha256 "PLACEHOLDER_ARM64"
  else
    url "https://github.com/ash-hun/claude-code-scanner/releases/download/v#{version}/Claude-Code-Scanner-#{version}-x64.dmg"
    sha256 "PLACEHOLDER_X64"
  end

  name "Claude Code Scanner"
  desc "Claude Code API Traffic Scanner & Analyzer"
  homepage "https://github.com/ash-hun/claude-code-scanner"

  app "Claude Code Scanner.app"

  caveats <<~EOS
    Docker Desktop is required for database features.
    Install it from https://www.docker.com/products/docker-desktop/ or:
      brew install --cask docker

    If macOS shows "app is damaged" warning, run:
      xattr -cr /Applications/Claude\\ Code\\ Scanner.app
  EOS

  zap trash: [
    "~/Library/Application Support/claude-code-scanner",
    "~/Library/Preferences/com.claude-code-scanner.app.plist",
    "~/Library/Logs/claude-code-scanner",
  ]
end
