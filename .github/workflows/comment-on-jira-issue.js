import dotenv from 'dotenv';
dotenv.config();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PR_TITLE = process.env.PR_TITLE;
let PR_BODY = process.env.PR_BODY;

import fetch from 'node-fetch';

// Extract the issue keys from the start of PR_TITLE
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

// Table handling function
const processTableLines = (lines) => {
  // Filter out the delimiter line.
  const filteredLines = lines.filter(line => !/^\|\s*[-]+\s*\|/.test(line));

  let headers = filteredLines[0].split('|').slice(1, -1).map(cell => cell.trim());

  let rows = filteredLines.slice(1).map(row =>
      row.split('|').slice(1, -1).map(cell => cell.trim())
  );

  return {
      "type": "table",
      "attrs": {
          "isNumberColumnEnabled": false,
          "layout": "default"
      },
      "content": [
          {
              "type": "tableRow",
              "content": headers.map(header => ({
                  "type": "tableHeader",
                  "attrs": {},
                  "content": [{
                      "type": "paragraph",
                      "content": [{
                          "type": "text",
                          "text": header,
                          "marks": [
                              {
                                  "type": "strong"
                              }
                          ]
                      }]
                  }]
              }))
          },
          ...rows.map(row => ({
              "type": "tableRow",
              "content": row.map(cell => ({
                  "type": "tableCell",
                  "attrs": {},
                  "content": [{
                      "type": "paragraph",
                      "content": [{"type": "text", "text": cell}]
                  }]
              }))
          }))
      ]
  };
}

// Process PR_BODY content
let i = 0;
const contentItems = [];
const lines = PR_BODY.split('\n');
while (i < lines.length) {
    let line = lines[i];

    // Identify the start of the table.
    if (line.startsWith('|') && lines[i + 1] && lines[i + 1].startsWith('| ---')) {
        let tableLines = [];
        while (i < lines.length && lines[i].startsWith('|')) {
            tableLines.push(lines[i]);
            i++;
        }
        contentItems.push(processTableLines(tableLines));
    } else {
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
                let lastIndex = 0;
                let match;
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const boldRegex = /\*\*([^*]+)\*\*/g;
                const combinedRegex = new RegExp(`(${urlRegex.source}|${boldRegex.source})`, 'g');

                while ((match = combinedRegex.exec(line)) !== null) {
                    if (match.index !== lastIndex) {
                        content.push(createContentItem(line.substring(lastIndex, match.index)));
                    }

                    // If it's a URL match.
                    if (match[1] && match[1].startsWith('http')) {
                        content.push({
                            "type": "text",
                            "text": match[1],
                            "marks": [{
                                "type": "link",
                                "attrs": {
                                    "href": match[1],
                                    "title": match[1]
                                }
                            }]
                        });
                    }
                    // If it's a bold match.
                    else if (match[1]) {
                      console.log(match[1]);
                      console.log(match[1].slice(2, -2));
                      const boldText = match[1].slice(2, -2);  // Remove ** from both ends
                      content.push(createContentItem(boldText, "text", [{"type": "strong"}]));
                    }

                    lastIndex = match.index + match[0].length;
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
