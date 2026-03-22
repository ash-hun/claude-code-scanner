# Homebrew Tap — Claude Code Scanner

## Installation

```bash
brew tap OWNER/claude-code-scanner https://github.com/OWNER/claude-code-scanner
brew install --cask claude-code-scanner
```

## Prerequisites

- **Docker Desktop** must be installed and running
  - The app automatically creates a PostgreSQL container on first launch (port 9020)

## Update

```bash
brew upgrade --cask claude-code-scanner
```

## Uninstall

```bash
brew uninstall --cask claude-code-scanner
# Optional: remove PostgreSQL container
docker rm -f claude-scanner-pg
docker volume rm claude-scanner-pgdata
```
