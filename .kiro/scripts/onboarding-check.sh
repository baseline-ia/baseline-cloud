#!/usr/bin/env bash
# Baseline onboarding check — outputs agent instructions for missing items
set -euo pipefail

ISSUES=()

# 1. Project linked to baseline-cloud?
if [ ! -f ".baseline/project.json" ]; then
  ISSUES+=("PROJECT_NOT_LINKED")
else
  SLUG=$(cat .baseline/project.json 2>/dev/null | grep -o '"slug"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"slug"[[:space:]]*:[[:space:]]*"//' | sed 's/"//')
  if [ -z "$SLUG" ]; then
    ISSUES+=("PROJECT_NO_SLUG")
  fi
fi

# 2. Cloud login?
CLOUD_STATUS=$(baseline cloud status 2>&1 || true)
if ! echo "$CLOUD_STATUS" | grep -q "Connected"; then
  ISSUES+=("CLOUD_NOT_LOGGED_IN")
fi

# 3. Engram configured?
ENGRAM_CHECK=$(engram --version 2>/dev/null && echo "installed" || echo "missing")
if [ "$ENGRAM_CHECK" = "missing" ]; then
  ISSUES+=("ENGRAM_NOT_INSTALLED")
else
  ENGRAM_MODE=$(engram config get mode 2>/dev/null || echo "unknown")
  if [ "$ENGRAM_MODE" = "unknown" ]; then
    ISSUES+=("ENGRAM_NOT_CONFIGURED")
  fi
fi

# 4. Git hooks?
HOOKS_PATH=$(git config --global core.hooksPath 2>/dev/null || echo "")
if [ -z "$HOOKS_PATH" ] || [ ! -f "$HOOKS_PATH/post-commit" ]; then
  ISSUES+=("HOOKS_NOT_INSTALLED")
fi

# Output
if [ ${#ISSUES[@]} -eq 0 ]; then
  echo ""
  exit 0
fi

echo "[Onboarding] The following items need setup in this project:"
echo ""

for issue in "${ISSUES[@]}"; do
  case "$issue" in
    PROJECT_NOT_LINKED)
      echo "- PROJECT: No .baseline/project.json found. Ask the developer for the project name/slug registered in baseline-cloud, then run: baseline openspec sync --project <slug> or create .baseline/project.json with {\"slug\": \"<name>\"}. If they want to skip, that's fine — just note telemetry won't be linked."
      ;;
    PROJECT_NO_SLUG)
      echo "- PROJECT: .baseline/project.json exists but has no slug. Ask the developer for the project slug."
      ;;
    CLOUD_NOT_LOGGED_IN)
      echo "- CLOUD LOGIN: Not authenticated with baseline-cloud. Ask the developer for their server URL and credentials, then run: baseline cloud login --server <url> --username <user> --password <pass>. Or guide them to run it manually."
      ;;
    ENGRAM_NOT_INSTALLED)
      echo "- ENGRAM: Engram is not installed. Run: npm install -g engram. Then configure with: engram setup."
      ;;
    ENGRAM_NOT_CONFIGURED)
      echo "- ENGRAM: Engram is installed but not configured for cloud sync. Ask if they have an ENGRAM_CLOUD_TOKEN. If yes, set it in their shell profile. If not, local mode is fine."
      ;;
    HOOKS_NOT_INSTALLED)
      echo "- GIT HOOKS: Post-commit hook not installed. Run: baseline hooks install"
      ;;
  esac
done

echo ""
echo "Guide the developer through each item conversationally. Be helpful, not pushy. If they say skip, respect it."
