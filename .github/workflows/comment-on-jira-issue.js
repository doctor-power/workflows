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

// Discard '# Checklist' and everything after it
PR_BODY = PR_BODY.split('# Checklist')[0];

// Replace <img> tags with the plain url
PR_BODY = PR_BODY.replace(/<img[^>]*src="([^"]*)"[^>]*>/g, '$1');

const createContentItem = (text, type = "text", marks = []) => ({
  "text": text,
  "type": type,
  "marks": marks
});

// Split PR_BODY by newlines and filter out empty items
const contentItems = PR_BODY.split('\n')
  .filter(item => item.trim() !== "")  // filter out empty or whitespace-only strings
  .map(item => {
      let content = [];

      // Handle bold (Markdown: **bold**)
      let lastIndex = 0;
      let boldMatch;
      const boldRegex = /\*\*([^*]+)\*\*/g;

      while ((boldMatch = boldRegex.exec(item)) !== null) {
          if (boldMatch.index !== lastIndex) {
              content.push(createContentItem(item.substring(lastIndex, boldMatch.index)));
          }
          content.push(createContentItem(boldMatch[1], "text", [{"type": "strong"}]));
          lastIndex = boldMatch.index + boldMatch[0].length;
      }

      if (lastIndex !== item.length) {
          content.push(createContentItem(item.substring(lastIndex)));
      }

      if (item.startsWith('## ')) {
          return {
              "content": content,
              "type": "heading",
              "attrs": {
                  "level": 2
              }
          };
      } else if (item.startsWith('# ')) {
          return {
              "content": content,
              "type": "heading",
              "attrs": {
                  "level": 1
              }
          };
      } else {
          return {
              "content": content,
              "type": "paragraph"
          };
      }
  });

// console.log(contentItems[0]);

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
