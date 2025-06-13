# GitHub-PDF Integration MCP Server

Dieser MCP Server verbindet dein PdfManagement System mit GitHub für automatisiertes Issue-Management.

## Features

- 🐛 **Automatische Issue-Erstellung** bei PDF-Verarbeitungsfehlern
- 🔗 **PDF-Verlinkung** zu bestehenden GitHub Issues
- 💡 **AI-Suggestions** als GitHub Issues
- 🔄 **Status-Synchronisation** zwischen PDF-System und GitHub

## Installation

1. **Dependencies installieren:**
   ```bash
   npm install
   ```

2. **Environment Variables konfigurieren:**
   ```bash
   cp .env.example .env
   ```
   
   Dann `.env` bearbeiten:
   - `GITHUB_TOKEN`: Personal Access Token von GitHub (benötigt `repo` Scope)
   - `PDF_API_KEY`: API Key vom PdfManagement System
   - `PDF_API_BASE_URL`: URL deines PDF Systems (default: http://hero.local:1339)

3. **Build:**
   ```bash
   npm run build
   ```

## Claude Desktop Integration

Füge folgendes zu deiner Claude Desktop Config hinzu:

```json
{
  "mcpServers": {
    "github-pdf-integration": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/Users/michaelnikolaus/github-pdf-integration-mcp-server",
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "PDF_API_KEY": "your_pdf_api_key",
        "PDF_API_BASE_URL": "http://hero.local:1339",
        "GITHUB_OWNER": "Minicon-eG",
        "GITHUB_REPO": "PdfManagement"
      }
    }
  }
}
```
## Verfügbare Tools

### create_issue_from_pdf_error
Erstellt automatisch ein GitHub Issue wenn ein PDF-Verarbeitungsfehler auftritt.

**Parameter:**
- `pdfId` (string): ID des betroffenen PDFs
- `errorType` (string): Fehlertyp (z.B. OCR_FAILED, PARSING_ERROR)
- `errorMessage` (string): Detaillierte Fehlermeldung
- `severity` (string, optional): low/medium/high/critical
- `stackTrace` (string, optional): Stack trace für Debugging

### link_pdf_to_issue
Verlinkt PDFs mit einem bestehenden GitHub Issue.

**Parameter:**
- `issueNumber` (number): GitHub Issue Nummer
- `pdfIds` (string[]): Array von PDF IDs

### create_issue_from_suggestion
Erstellt ein Issue aus einer AI-generierten Verbesserung.

**Parameter:**
- `pdfId` (string): ID des PDFs
- `suggestionType` (string): Art der Verbesserung
- `suggestion` (string): Verbesserungsvorschlag
- `autoAssign` (boolean, optional): Automatische Zuweisung

### sync_pdf_status_to_issue
Synchronisiert den PDF-Status mit verknüpften Issues.

**Parameter:**
- `pdfId` (string): ID des PDFs
- `status` (string): processing/completed/failed/requires_review

## Beispiel-Integration in PdfManagement

```csharp
// In deinem PDF Error Handler
public async Task HandlePdfError(string pdfId, Exception ex)
{
    // Lokales Error Handling...
    
    // MCP Tool aufrufen via Claude API
    await CallMcpTool("create_issue_from_pdf_error", new {
        pdfId = pdfId,
        errorType = ex.GetType().Name,
        errorMessage = ex.Message,
        severity = "high",
        stackTrace = ex.StackTrace
    });
}
```

## Entwicklung

```bash
# Development mode mit hot-reload
npm run dev

# Type checking
npm run build
```

## Lizenz

MIT - Michael Nikolaus / Minicon eG
