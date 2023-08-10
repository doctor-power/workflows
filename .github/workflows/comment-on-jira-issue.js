import dotenv from 'dotenv';
dotenv.config();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PR_TITLE = process.env.PR_TITLE;
let PR_BODY = process.env.PR_BODY;

import fetch from 'node-fetch';

// Extract the issue keys from start of PR_TITLE
const ISSUE_KEYS = PR_TITLE.split(':')[0].match(/[A-Z]+-\d+/g);

// Discard '## Checklist' and everything after it
PR_BODY = PR_BODY.split('## Checklist')[0];

// Replace <img> tags with the plain url
PR_BODY = PR_BODY.replace(/<img[^>]*src="([^"]*)"[^>]*>/g, '$1');

const createContentItem = (text, type = "text", marks = []) => ({
  "text": text,
  "type": type,
  "marks": marks
});

// Table handling helper function
const processTableLines = (lines) => {
  let headers = lines[0].split('|').slice(1, -1).map(cell => cell.trim());

  let rows = lines.slice(2).map(row =>
      row.split('|').slice(1, -1).map(cell => cell.trim())
  );

  return {
      "type": "table",
      "content": [
          {
              "type": "tableRow",
              "content": headers.map(header => ({
                  "type": "tableHeader",
                  "content": [{ "type": "text", "text": header }]
              }))
          },
          ...rows.map(row => ({
              "type": "tableRow",
              "content": row.map(cell => ({
                  "type": "tableCell",
                  "content": [{ "type": "text", "text": cell }]
              }))
          }))
      ]
  };
}

// Modified content items mapping
let i = 0;
const contentItems = [];
const lines = PR_BODY.split('\n');
while (i < lines.length) {
    let line = lines[i];

    if (line.startsWith('|') && line.endsWith('|')) {
        let tableLines = [];
        while (i < lines.length && lines[i].startsWith('|') && lines[i].endsWith('|')) {
            tableLines.push(lines[i]);
            i++;
        }
        contentItems.push(processTableLines(tableLines));
    } else {
        // ... (existing handling for non-table lines)
        if (line.trim() !== "") {
            if (line.startsWith('### ')) {
                line = line.replace(/^### /, '');
                contentItems.push({
                    "content": [{
                        "text": line,
                        "type": "text"
                    }],
                    "type": "heading",
                    "attrs": {
                        "level": 3
                    }
                });
            } else if (line.startsWith('## ')) {
                line = line.replace(/^## /, '');
                contentItems.push({
                    "content": [{
                        "text": line,
                        "type": "text"
                    }],
                    "type": "heading",
                    "attrs": {
                        "level": 2
                    }
                });
            } else if (line.startsWith('# ')) {
                line = line.replace(/^# /, '');
                contentItems.push({
                    "content": [{
                        "text": line,
                        "type": "text"
                    }],
                    "type": "heading",
                    "attrs": {
                        "level": 1
                    }
                });
            } else {
                let content = [];

                // Handle bold (Markdown: **bold**)
                let lastIndex = 0;
                let boldMatch;
                const boldRegex = /\*\*([^*]+)\*\*/g;

                while ((boldMatch = boldRegex.exec(line)) !== null) {
                    if (boldMatch.index !== lastIndex) {
                        content.push(createContentItem(line.substring(lastIndex, boldMatch.index)));
                    }
                    content.push(createContentItem(boldMatch[1], "text", [{"type": "strong"}]));
                    lastIndex = boldMatch.index + boldMatch[0].length;
                }

                if (lastIndex !== line.length) {
                    content.push(createContentItem(line.substring(lastIndex)));
                }

                contentItems.push({
                    "content": content,
                    "type": "paragraph"
                });
            }
        }
        i++;
    }
}

const bodyData = JSON.stringify({
  "body": {
    "content": contentItems,
    "type": "doc",
    "version": 1
  }
});

/* Comment on each Jira issue with updated PR_BODY */
const commentOnJiraIssue = async () => {
  try {
    for (const ISSUE_KEY of ISSUE_KEYS) {
      const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${ISSUE_KEY}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`
          ).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: bodyData
      })
      .then(response => {
        console.log(
          `Response: ${response.status} ${response.statusText}`
        );
        return response.text();
      })
      .then(text => console.log(text))
      .catch(err => console.error(err));
    }
  } catch (error) {
    console.error(error);
  }
}

commentOnJiraIssue();
