# Spenny AI MCP Server

[![npm version](https://badge.fury.io/js/spenny-ai-mcp-server.svg)](https://badge.fury.io/js/spenny-ai-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Connect your Spenny AI expense data to Claude Desktop with **zero installation** required. Chat with Claude about your personal finances using natural language!

## 🚀 Quick Start (2 Minutes)

### 1. Get Your API Key

1. Visit [Spenny AI Dashboard](https://spenny-ai.com)
2. Go to **Settings** → **API Keys**
3. Click **"Generate New API Key"**
4. Copy the key (starts with `sk_spenny_`)

### 2. Add to Claude Desktop

Add this configuration to your Claude Desktop config file:

**Find your config file:**

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**Add this configuration:**

```json
{
  "mcpServers": {
    "spenny-ai": {
      "command": "npx",
      "args": ["spenny-ai-mcp-server"],
      "env": {
        "SPENNY_API_KEY": "sk_spenny_your_actual_api_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Completely quit and restart Claude Desktop for changes to take effect.

### 4. Start Chatting! 🎉

Ask Claude questions about your expenses:

_"What did I spend this month?"_  
_"Show me my food expenses for the last 3 months"_  
_"Give me insights on my spending patterns"_  
_"How does my budget compare to Indian household recommendations?"_

## 💬 Example Conversations

### Monthly Overview

```
You: "Give me a summary of my expenses this month"

Claude: Based on your Spenny AI data, here's your December 2024 summary:
- Total spent: ₹45,230
- Top category: Food & Dining (₹18,500)
- Transaction count: 67 expenses
- Daily average: ₹1,459
```

### Category Analysis

```
You: "What are my top spending categories?"

Claude: Your top spending categories this month:
1. Food & Dining: ₹18,500 (41%)
2. Transportation: ₹12,200 (27%)
3. Shopping: ₹8,100 (18%)
4. Entertainment: ₹4,200 (9%)
5. Healthcare: ₹2,230 (5%)
```

### Budget Insights

```
You: "How is my spending compared to recommended budgets?"

Claude: Based on Indian household budget recommendations:
✅ Food (30%): Within range - you're spending 29%
⚠️ Transportation (15%): Slightly over - you're at 19%
✅ Savings rate: Excellent at 25% (recommended 20-30%)
```

## 🛠️ Available Features

The MCP server provides these capabilities to Claude:

| Feature                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| **Expense Retrieval**  | Get expenses with date, category, and amount filters    |
| **Monthly Summaries**  | View spending summaries for specific months             |
| **Category Breakdown** | Analyze spending patterns by category                   |
| **Search Expenses**    | Find expenses by description or merchant                |
| **Spending Insights**  | AI-powered analysis of spending patterns                |
| **Budget Analysis**    | Compare against Indian household budget recommendations |
| **Trend Analysis**     | Month-over-month and period comparisons                 |

## 🏦 Indian Context Features

This MCP server is specifically designed for Indian users:

- **₹ INR Formatting** - All amounts displayed in Indian Rupees
- **Indian Budget Recommendations** - Based on typical Indian household spending patterns
- **Festival & Family Expenses** - Considerations for Indian lifestyle
- **Local Categories** - Expense categories relevant to Indian users

## 🔒 Security & Privacy

- **Local Authentication** - Your API key is stored only on your device
- **Direct Connection** - Data flows directly between Claude and Spenny AI
- **No Third Parties** - No intermediate servers or data storage
- **Revocable Access** - Disable API keys anytime from Spenny AI dashboard

## 🔧 Technical Details

### System Requirements

- **Node.js** 16.0.0 or higher
- **Claude Desktop** with MCP support
- **Internet connection** (for initial download only)

### How It Works

1. **npx** automatically downloads the latest version
2. **MCP Protocol** enables Claude to call expense functions
3. **API Authentication** ensures secure access to your data
4. **Supabase Integration** connects to Spenny AI backend

### Data Flow

```
Claude Desktop → MCP Server → Spenny AI API → Your Expense Data
```

## 🐛 Troubleshooting

### Common Issues

**❌ "Failed to start MCP server"**

- Ensure Node.js 16+ is installed: `node --version`
- Check internet connection for npx download
- Verify JSON syntax in config file

**❌ "Invalid API key"**

- Check your API key is correct and active
- Generate a new key from Spenny AI dashboard
- Ensure no extra spaces in the key

**❌ "No tools available"**

- Verify config file location is correct
- Restart Claude Desktop completely
- Check config file syntax with JSON validator

**❌ "Permission denied"**

- Check API key hasn't expired
- Verify your Spenny AI account is active
- Try generating a fresh API key

### Debug Mode

Add debug environment variable:

```json
{
  "mcpServers": {
    "spenny-ai": {
      "command": "npx",
      "args": ["spenny-ai-mcp-server"],
      "env": {
        "SPENNY_API_KEY": "your_key_here",
        "DEBUG": "true"
      }
    }
  }
}
```

### Getting Help

- 📧 **Email:** support@spenny-ai.com
- 🐛 **Issues:** [GitHub Issues](https://github.com/spenny-ai/mcp-server/issues)
- 📚 **Docs:** [Spenny AI Documentation](https://docs.spenny-ai.com)

## 📱 Alternative Installation Methods

### Global Installation

```bash
npm install -g spenny-ai-mcp-server
```

```json
{
  "mcpServers": {
    "spenny-ai": {
      "command": "node",
      "args": ["-e", "require('spenny-ai-mcp-server')"],
      "env": { "SPENNY_API_KEY": "your_key_here" }
    }
  }
}
```

### Local Installation

```bash
npm install spenny-ai-mcp-server
```

```json
{
  "mcpServers": {
    "spenny-ai": {
      "command": "node",
      "args": ["./node_modules/spenny-ai-mcp-server/index.js"],
      "env": { "SPENNY_API_KEY": "your_key_here" }
    }
  }
}
```

### Docker (Advanced)

```bash
docker run -e SPENNY_API_KEY=your_key spenny-ai/mcp-server
```

## 🔄 Updates

The server automatically uses the latest version via npx. No manual updates needed!

To force a specific version:

```json
{
  "mcpServers": {
    "spenny-ai": {
      "command": "npx",
      "args": ["spenny-ai-mcp-server@1.2.3"],
      "env": { "SPENNY_API_KEY": "your_key" }
    }
  }
}
```

## 📊 Usage Examples

### Basic Queries

```
"Show me today's expenses"
"What did I spend on food this week?"
"List my biggest expenses this month"
```

### Advanced Analysis

```
"Compare my spending this month vs last month"
"Give me budget recommendations based on my income of ₹80,000"
"What are my spending patterns on weekdays vs weekends?"
```

### Search & Filter

```
"Find all expenses related to 'Uber'"
"Show me expenses above ₹1000 in the last month"
"What did I spend on healthcare this quarter?"
```

## 🏆 Why Use This?

✅ **Zero Setup** - Just add config and restart Claude  
✅ **Natural Language** - Chat about finances conversationally  
✅ **Always Updated** - Latest features automatically  
✅ **Secure** - Your data stays private  
✅ **Indian Focus** - Built for Indian users and currency  
✅ **Rich Insights** - AI-powered spending analysis

## 📄 License

MIT License - see [LICENSE](https://github.com/spenny-ai/mcp-server/blob/main/LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/spenny-ai/mcp-server/blob/main/CONTRIBUTING.md) for details.

## 📈 Changelog

### v1.0.0

- Initial release
- Basic expense retrieval and analysis
- Indian currency formatting
- Budget recommendations

---

**Made with ❤️ by the Spenny AI Team**  
**Transform how you understand your finances with AI-powered conversations.**
