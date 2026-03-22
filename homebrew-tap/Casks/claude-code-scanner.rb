cask "claude-code-scanner" do
  version "0.1.1"

  if Hardware::CPU.arm?
    url "https://github.com/ash-hun/claude-code-scanner/releases/download/v#{version}/Claude-Code-Scanner-0.1.0-arm64.dmg"
    sha256 "902d6d91e4ea3b5e1ea7e3a199731d57463c8154ddc32db1fbd3417e826a5eb1"
  else
    url "https://github.com/ash-hun/claude-code-scanner/releases/download/v#{version}/Claude-Code-Scanner-0.1.0-x64.dmg"
    sha256 "c516ba1161930896daaf3f3bb2bb991ce8309399783ce3c47f4a1ade1f9cfa1e"
  end

  name "Claude Code Scanner"
  desc "Claude Code API Traffic Scanner & Analyzer"
  homepage "https://github.com/ash-hun/claude-code-scanner"

  app "Claude Code Scanner.app"

  caveats <<~EOS
    Docker Desktop is required for database features.
    Install it from https://www.docker.com/products/docker-desktop/ or:
      brew install --cask docker
  EOS

  zap trash: [
    "~/Library/Application Support/claude-code-scanner",
    "~/Library/Preferences/com.claude-code-scanner.app.plist",
    "~/Library/Logs/claude-code-scanner",
  ]
end
