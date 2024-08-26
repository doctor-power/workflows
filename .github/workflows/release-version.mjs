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

const fetchUnreleasedJiraFixVersions = async () => {
  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/project/${PROJECT_KEY}/version?status=unreleased&orderBy=name`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`
      ).toString('base64')}`,
      'Accept': 'application/json'
    }
  });

  const json = await response.json();
  const values = json.values;
  console.log('Unreleased Jira fixVersions:', values.map(fixVersion => fixVersion.name));
  return values.map(fixVersion => fixVersion.name);
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
    const currentFixVersionNames = await fetchCurrentFixVersions(); // Fix Versions currently assigned to the issue
    let predictedFixVersion = null;

    // return early if (currentFixVersionNames.length > 1)
    //  i.e. if the issue has more than one fixVersion assigned to it
    if (currentFixVersionNames.length > 1) {
      console.error('More than one fixVersion assigned to issue. This shouldn\'t be the case. Unclear how to proceed, so returning early.');
      process.exit(1);
    } else {
      predictedFixVersion = currentFixVersionNames[0];
    }

    // Get all unreleased fixVersions in the Jira project, retrieved in ascending order
    let unreleasedJiraFixVersions = await fetchUnreleasedJiraFixVersions();

    let correctFixVersion = null;
    if (PR_BASE_BRANCH.includes('release')) {
      // If the base branch is a release branch with a matching Jira fixVersion, use the release branch number as the correct fixVersion
      // e.g. if the base branch is release/1.2, and there is a Jira fixVersion 1.2.0, use 1.2.0 as the correct fixVersion
      const releaseBranchNumber = PR_BASE_BRANCH.match(/\d+\.\d+$/)[0] + '.0';
      if (unreleasedJiraFixVersions.includes(releaseBranchNumber)) {
        correctFixVersion = releaseBranchNumber;
        console.log('Base branch is a release branch with a matching unreleased Jira fixVersion. Using the release branch number as the correct fixVersion.')
        console.log('Currently assigned fixVersion for Jira ticket:', predictedFixVersion);
        console.log('Correct fixVersion:', correctFixVersion);
      } else {
        console.log('Release branch number:', releaseBranchNumber)
        console.log('All unreleased fixVersions in the Jira project:', unreleasedJiraFixVersions);
        console.error('Release branch number not found in Jira fixVersions. Unclear how to proceed, so returning early.');
        process.exit(1);
      }
    } else if (github_release_branches.length > 0) {
        // Get the release branch numbers from the Github release branches
        github_release_branches = github_release_branches.split(',').map(item => {
          // Release branch names ommit the patch version number, so add it back in
          return item.trim().substring(item.length - 4) + '.0';
        })
        const githubReleaseBranchNumbers = sortVersionsDescending(github_release_branches);

        console.log('All unreleased fixVersions in the Jira project:', unreleasedJiraFixVersions);
        console.log('Github release branches:', githubReleaseBranchNumbers);
        console.log('Currently assigned fixVersion for Jira ticket:', predictedFixVersion);

        // Get the highest release branch number
        let highestReleaseBranchNum = githubReleaseBranchNumbers[0];

        // Find the lowest Jira version number that is higher than the highest release branch number
        correctFixVersion = unreleasedJiraFixVersions.find(item => item > highestReleaseBranchNum)
        console.log('Correct fixVersion:', correctFixVersion);
    } else {
      // If there are no release branches, use the lowest Jira version number as the correct fixVersion
      correctFixVersion = unreleasedJiraFixVersions[0];
      console.log('No release branches found. Using the lowest unreleased Jira version number as the correct fixVersion.')
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
        process.exit(1);
      }
    } else {
      console.log('✅ Correct fixVersion is the same as the currently assigned fixVersion. No update needed.');
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Execute the function
fetchAndCompare();
