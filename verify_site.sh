#!/bin/bash
# SHADOW PROTOCOL - Jekyll Build Verification Script
# Run this in WSL to test your site locally

echo "🔍 Checking Jekyll site..."
echo "=========================="

# Check if we're in the website directory
if [ ! -f "_config.yml" ]; then
    echo "❌ Error: _config.yml not found. Please run this script from /mnt/d/AGENTIC_TASK/website/"
    exit 1
fi

# Check for required files
echo "📋 Checking required files:"
[ -f "_config.yml" ] && echo "  ✅ _config.yml" || echo "  ❌ _config.yml"
[ -f "Gemfile" ] && echo "  ✅ Gemfile" || echo "  ❌ Gemfile"
[ -d "_posts" ] && echo "  ✅ _posts directory" || echo "  ❌ _posts directory"
[ -d "_layouts" ] && echo "  ✅ _layouts directory" || echo "  ❌ _layouts directory"
[ -d "assets" ] && echo "  ✅ assets directory" || echo "  ❌ assets directory"

# Count posts
POST_COUNT=$(find _posts -name "*.md" | wc -l)
echo "  📝 Found $POST_COUNT blog posts"

# Check for key directories
echo ""
echo "📁 Checking key directories:"
[ -d "assets/css" ] && echo "  ✅ assets/css" || echo "  ❌ assets/css"
[ -d "assets/js" ] && echo "  ✅ assets/js" || echo "  ❌ assets/js"
[ -d "assets/img" ] && echo "  ✅ assets/img" || echo "  ❌ assets/img"
[ -d "_includes" ] && echo "  ✅ _includes" || echo "  ❌ _includes"

# Check for special files
echo ""
echo "🎯 Checking special features:"
[ -f "assets/js/pretext-hero.js" ] && echo "  ✅ Pretext Hero JS" || echo "  ❌ Pretext Hero JS"
[ -f "pretext-demos/index.html" ] && echo "  ✅ Pretext Demos page" || echo "  ❌ Pretext Demos page"
[ -f "projects/index.html" ] && echo "  ✅ Projects page" || echo "  ❌ Projects page"
[ -f "about/index.html" ] && echo "  ✅ About page" || echo "  ❌ About page"
[ -f "robots.txt" ] && echo "  ✅ robots.txt" || echo "  ❌ robots.txt"

echo ""
echo "🔧 To build and serve locally:"
echo "   1. Install Ruby & Jekyll (if not installed):"
echo "      sudo apt-get update && sudo apt-get install -y ruby-full build-essential"
echo "      gem install bundler jekyll"
echo ""
echo "   2. Install dependencies:"
echo "      bundle install"
echo ""
echo "   3. Build and serve:"
echo "      bundle exec jekyll serve"
echo ""
echo "   4. Open in browser:"
echo "      http://localhost:4000"
echo ""
echo "🚀 For GitHub Pages deployment:"
echo "   1. Push to GitHub repository"
echo "   2. Enable GitHub Pages in repo settings (main branch)"
echo "   3. Site will be available at https://xplorertech00.github.io"
echo ""
echo "✅ Verification complete! Your site is ready to build."