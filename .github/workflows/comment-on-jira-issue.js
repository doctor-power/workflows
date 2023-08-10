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

// Split PR_BODY by newlines and filter out empty items
const contentItems = PR_BODY.split('\n')
    .filter(item => item.trim() !== "")  // filter out empty or whitespace-only strings
    .map(item => {
        return {
            "content": [{
                "text": item,
                "type": "text"
            }],
            "type": "paragraph"
        };
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
