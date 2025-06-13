#!/bin/bash

echo "🚀 Setting up GitHub-PDF Integration MCP Server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your credentials!"
    echo "   - Add your GitHub Personal Access Token"
    echo "   - Add your PDF Management API Key"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your .env file is configured"
echo "2. Add the server to your Claude Desktop config"
echo "3. Restart Claude Desktop"
echo ""
echo "🧪 To test the server manually:"
echo "   npm run dev"
