import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['GITHUB_TOKEN', 'PDF_API_BASE_URL', 'PDF_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Initialize PDF API client
const pdfApi = axios.create({
  baseURL: process.env.PDF_API_BASE_URL,
  headers: {
    'X-API-Key': process.env.PDF_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Default configuration
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Minicon-eG';
const GITHUB_REPO = process.env.GITHUB_REPO || 'PdfManagement';
const DEFAULT_LABELS = process.env.DEFAULT_LABELS?.split(',') || ['auto-generated', 'pdf-error'];
// Tool definitions
const tools: Tool[] = [
  {
    name: 'create_issue_from_pdf_error',
    description: 'Creates a GitHub issue from a PDF processing error',
    inputSchema: {
      type: 'object',
      properties: {
        pdfId: {
          type: 'string',
          description: 'ID of the PDF that caused the error',
        },
        errorType: {
          type: 'string',
          description: 'Type of error (e.g., OCR_FAILED, PARSING_ERROR, AI_ANALYSIS_FAILED)',
        },
        errorMessage: {
          type: 'string',
          description: 'Detailed error message',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity of the error',
        },
        stackTrace: {
          type: 'string',
          description: 'Optional stack trace for debugging',
        },
      },
      required: ['pdfId', 'errorType', 'errorMessage'],
    },
  },
  {
    name: 'link_pdf_to_issue',
    description: 'Links one or more PDFs to an existing GitHub issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueNumber: {
          type: 'number',
          description: 'GitHub issue number',
        },
        pdfIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of PDF IDs to link',
        },
      },
      required: ['issueNumber', 'pdfIds'],
    },
  },
  {
    name: 'create_issue_from_suggestion',
    description: 'Creates a GitHub issue from an AI-generated suggestion',
    inputSchema: {
      type: 'object',
      properties: {
        pdfId: {
          type: 'string',
          description: 'ID of the PDF that generated the suggestion',
        },
        suggestionType: {
          type: 'string',
          description: 'Type of suggestion (e.g., MISSING_DATA, QUALITY_IMPROVEMENT)',
        },
        suggestion: {
          type: 'string',
          description: 'The suggestion content',
        },
        autoAssign: {
          type: 'boolean',
          description: 'Whether to auto-assign based on component',
        },
      },
      required: ['pdfId', 'suggestionType', 'suggestion'],
    },
  },
  {
    name: 'sync_pdf_status_to_issue',
    description: 'Updates GitHub issue status based on PDF processing status',
    inputSchema: {
      type: 'object',
      properties: {
        pdfId: {
          type: 'string',
          description: 'ID of the PDF',
        },
        status: {
          type: 'string',
          enum: ['processing', 'completed', 'failed', 'requires_review'],
          description: 'Current PDF processing status',
        },
      },
      required: ['pdfId', 'status'],
    },
  },
];

// Helper functions
async function getPdfDetails(pdfId: string) {
  try {
    const response = await pdfApi.get(`/api/v1/pdf/${pdfId}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to get PDF details for ${pdfId}:`, error);
    return null;
  }
}

function getSeverityLabel(severity?: string): string {
  const severityMap: Record<string, string> = {
    critical: '🔴 priority:critical',
    high: '🔴 priority:high',
    medium: '🟡 priority:medium',
    low: '🟢 priority:low',
  };
  return severityMap[severity || 'medium'] || '🟡 priority:medium';
}

function getComponentLabel(errorType: string): string {
  const componentMap: Record<string, string> = {
    OCR_FAILED: '🔍 ocr',
    PARSING_ERROR: '📄 domain',
    AI_ANALYSIS_FAILED: '🤖 ai-integration',
    API_ERROR: '🔌 api',
    MONGODB_ERROR: '🗄️ mongodb',
  };
  return componentMap[errorType] || '📄 domain';
}

// Main server setup
const server = new Server(
  {
    name: 'github-pdf-integration-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_issue_from_pdf_error': {
      const { pdfId, errorType, errorMessage, severity, stackTrace } = args as any;
      
      // Get PDF details
      const pdfDetails = await getPdfDetails(pdfId);
      const fileName = pdfDetails?.fileName || 'Unknown PDF';
      
      // Create issue
      const issueTitle = `[${errorType}] Error processing PDF: ${fileName}`;
      const issueBody = `## Error Details
      
**PDF ID**: ${pdfId}
**File Name**: ${fileName}
**Error Type**: ${errorType}
**Severity**: ${severity || 'medium'}

### Error Message
\`\`\`
${errorMessage}
\`\`\`

${stackTrace ? `### Stack Trace\n\`\`\`\n${stackTrace}\n\`\`\`\n` : ''}

### PDF Details
${pdfDetails ? `
- **Upload Date**: ${pdfDetails.uploadDate}
- **Size**: ${pdfDetails.size} bytes
- **Company**: ${pdfDetails.company || 'N/A'}
` : 'Failed to retrieve PDF details'}

### Reproduction Steps
1. Navigate to PDF Management System
2. Search for PDF ID: \`${pdfId}\`
3. Attempt to process/view the PDF

---
*This issue was automatically generated by the PDF Management System*`;

      const labels = [
        ...DEFAULT_LABELS,
        '🐛 bug',
        getSeverityLabel(severity),
        getComponentLabel(errorType),
      ];

      try {
        const issue = await octokit.issues.create({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          title: issueTitle,
          body: issueBody,
          labels,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created issue #${issue.data.number}: ${issue.data.html_url}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create issue: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'link_pdf_to_issue': {
      const { issueNumber, pdfIds } = args as any;
      
      try {
        // Get current issue
        const issue = await octokit.issues.get({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          issue_number: issueNumber,
        });

        // Get PDF details for all PDFs
        const pdfDetailsPromises = pdfIds.map((id: string) => getPdfDetails(id));
        const pdfDetailsList = await Promise.all(pdfDetailsPromises);

        // Create comment with PDF links
        const commentBody = `## Linked PDFs

The following PDFs are related to this issue:

${pdfDetailsList.map((pdf, index) => {
  if (!pdf) return `- ❌ PDF ID: ${pdfIds[index]} (Details not found)`;
  return `- 📄 **${pdf.fileName}** (ID: ${pdf.id})
  - Size: ${pdf.size} bytes
  - Uploaded: ${pdf.uploadDate}
  - [View in PDF Management](${process.env.PDF_API_BASE_URL}/pdf/${pdf.id})`;
}).join('\n')}

---
*PDFs linked via GitHub-PDF Integration*`;

        await octokit.issues.createComment({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          issue_number: issueNumber,
          body: commentBody,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully linked ${pdfIds.length} PDF(s) to issue #${issueNumber}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to link PDFs: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'create_issue_from_suggestion': {
      const { pdfId, suggestionType, suggestion, autoAssign } = args as any;
      
      const pdfDetails = await getPdfDetails(pdfId);
      const fileName = pdfDetails?.fileName || 'Unknown PDF';
      
      const issueTitle = `[Suggestion] ${suggestionType}: ${fileName}`;
      const issueBody = `## AI-Generated Suggestion

**PDF ID**: ${pdfId}
**File Name**: ${fileName}
**Suggestion Type**: ${suggestionType}

### Suggestion
${suggestion}

### PDF Context
${pdfDetails ? `
- **Company**: ${pdfDetails.company || 'N/A'}
- **Upload Date**: ${pdfDetails.uploadDate}
- **Last Processed**: ${pdfDetails.lastProcessed || 'N/A'}
` : 'Failed to retrieve PDF details'}

### Action Items
- [ ] Review suggestion
- [ ] Implement changes if applicable
- [ ] Update PDF processing rules
- [ ] Test with similar PDFs

---
*This issue was automatically generated from an AI suggestion*`;

      const labels = [
        ...DEFAULT_LABELS,
        '✨ feature',
        'ai-suggestion',
      ];

      try {
        const issue = await octokit.issues.create({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          title: issueTitle,
          body: issueBody,
          labels,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Created suggestion issue #${issue.data.number}: ${issue.data.html_url}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create suggestion issue: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'sync_pdf_status_to_issue': {
      const { pdfId, status } = args as any;
      
      try {
        // Search for issues related to this PDF
        const searchQuery = `repo:${GITHUB_OWNER}/${GITHUB_REPO} "${pdfId}" in:body is:open`;
        const searchResults = await octokit.search.issuesAndPullRequests({
          q: searchQuery,
        });

        if (searchResults.data.items.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No open issues found for PDF ID: ${pdfId}`,
              },
            ],
          };
        }

        // Update all related issues
        const statusMessages: Record<string, string> = {
          processing: '🔄 PDF is currently being processed',
          completed: '✅ PDF processing completed successfully',
          failed: '❌ PDF processing failed',
          requires_review: '👀 PDF requires manual review',
        };

        const updatePromises = searchResults.data.items.map(async (issue) => {
          await octokit.issues.createComment({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            issue_number: issue.number,
            body: `## Status Update\n\n${statusMessages[status]}\n\n**PDF ID**: ${pdfId}\n**Timestamp**: ${new Date().toISOString()}`,
          });

          // Close issue if status is completed
          if (status === 'completed') {
            await octokit.issues.update({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              issue_number: issue.number,
              state: 'closed',
              state_reason: 'completed',
            });
          }
        });

        await Promise.all(updatePromises);

        return {
          content: [
            {
              type: 'text',
              text: `Updated ${searchResults.data.items.length} issue(s) with PDF status: ${status}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to sync status: ${error.message}`,
            },
          ],
        };
      }
    }

    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
      };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub-PDF Integration MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
