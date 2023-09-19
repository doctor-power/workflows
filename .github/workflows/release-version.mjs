import dotenv from 'dotenv';
dotenv.config();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const ISSUE_KEY = process.env.ISSUE_KEY;
const PROJECT_KEY = process.env.PROJECT_KEY;
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PR_BASE_BRANCH = process.env.PR_BASE_BRANCH;
let github_release_branches = process.env.GITHUB_RELEASE_BRANCHES;

import fetch from 'node-fetch';

const fetchCurrentFixVersions = async () => {
  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${ISSUE_KEY}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`
      ).toString('base64')}`,
      'Accept': 'application/json'
    }
  });

  const json = await response.json();
  const fixVersions = json.fields.fixVersions;
  return fixVersions.map(fixVersion => fixVersion.name);
};

const fetchAllJiraFixVersions = async () => {
  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/project/${PROJECT_KEY}/versions`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`
      ).toString('base64')}`,
      'Accept': 'application/json'
    }
  });

  const json = await response.json();
  return json.map(fixVersion => fixVersion.name);
};

function sortVersionsDescending(versions) {
  return versions.sort((a, b) => {
      let aParts = a.split('.').map(Number);
      let bParts = b.split('.').map(Number);

      for (let i = 0; i < aParts.length; i++) {
          if (aParts[i] > bParts[i]) return -1;
          if (aParts[i] < bParts[i]) return 1;
      }
  });
}

// Determine which fixVersion should be assigned to the Jira issue
const fetchAndCompare = async () => {
  try {
    const currentFixVersionNames = await fetchCurrentFixVersions();
    let predictedFixVersion = null;

    // return early if (currentFixVersionNames.length > 1)
    if (currentFixVersionNames.length > 1) {
      console.log('More than one fixVersion assigned to issue. This shouldn\'t be the case. Unclear how to proceed, so returning early.');
      return;
    } else {
      predictedFixVersion = currentFixVersionNames[0];
    }

    let allJiraFixVersions = await fetchAllJiraFixVersions();
    allJiraFixVersions = sortVersionsDescending(allJiraFixVersions).reverse();

    let correctFixVersion = null;
    // If the base branch is a release branch with a matching Jira fixVersion, use the release branch number as the correct fixVersion
    if (PR_BASE_BRANCH.includes('release')) {
      const releaseBranchNumber = PR_BASE_BRANCH.split('-').pop();
      if (allJiraFixVersions.includes(releaseBranchNumber)) {
        correctFixVersion = releaseBranchNumber;
        console.log('Base branch is a release branch with a matching Jira fixVersion. Using the release branch number as the correct fixVersion.')
        console.log('Currently assigned fixVersion:', predictedFixVersion);
        console.log('Correct fixVersion:', correctFixVersion);
      } else {
        console.log('Release branch number not found in Jira fixVersions. This shouldn\'t be the case. Unclear how to proceed, so returning early.');
        return;
      }
    }  else {
      // Get the release branch numbers from the Github release branches
      github_release_branches = github_release_branches.split(',').map(item => {
        return item.trim().substring(item.length - 5);
      })
      const githubReleaseBranchNumbers = sortVersionsDescending(github_release_branches);

      console.log('All fixVersions in the project:', allJiraFixVersions);
      console.log('Github release branches:', githubReleaseBranchNumbers);

      console.log('Currently assigned fixVersion:', predictedFixVersion);

      // Get the highest release branch number
      let highestReleaseBranchNum = githubReleaseBranchNumbers[0];

      // Find the lowest Jira version number that is higher than the highest release branch number
      correctFixVersion = allJiraFixVersions.find(item => item > highestReleaseBranchNum)
      console.log('Correct fixVersion:', correctFixVersion);
    }

    // If the correct fixVersion is not the same as the currently assigned fixVersion, update the issue
    if (predictedFixVersion !== correctFixVersion) {
      console.log('Updating issue...');
      const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${ISSUE_KEY}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`
          ).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          update: {
            fixVersions: [
              {
                set: [
                  {
                    name: correctFixVersion
                  }
                ]
              }
            ]
          }
        })
      });

      // Check the response status
      if (response.status === 204) { // Check for the appropriate successful status code here
        console.log("✅ Issue updated with fixVersion:", correctFixVersion);
      } else {
        console.error("Error updating fixVersion", await response.text());
      }
    }
  } catch (err) {
    console.error(err);
  }
};

// Execute the function
fetchAndCompare();
