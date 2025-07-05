#!/bin/bash

# Replace YOUR_USERNAME with your actual GitHub username
echo "Enter your GitHub username:"
read GITHUB_USERNAME

echo "Is the repository public or private? (public/private):"
read REPO_VISIBILITY

# Add remote origin
git remote add origin "https://github.com/${GITHUB_USERNAME}/ScreenPilot.git"

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin main

echo "✅ Successfully pushed to GitHub!"
echo "🌐 Your repository is now at: https://github.com/${GITHUB_USERNAME}/ScreenPilot"
echo ""
echo "Next steps:"
echo "1. Add topics: electron, macos, gpt-4, ai, productivity"
echo "2. Add a license if needed (MIT recommended)"
echo "3. Enable GitHub Pages for documentation (optional)"
echo "4. Set up GitHub Actions secrets for automated builds"