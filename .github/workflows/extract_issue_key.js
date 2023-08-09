import dotenv from 'dotenv';
dotenv.config();

const BRANCH_NAME = process.env.BRANCH_NAME;
const PROJECT_KEY = process.env.PROJECT_KEY;
const CURRENT_PR_TITLE = process.env.CURRENT_PR_TITLE;

/* Extract the issue key from the branch name */
let ISSUE_KEY;
const regex = new RegExp(`^${PROJECT_KEY}-\\d+`);

if (BRANCH_NAME.match(regex)) {
    ISSUE_KEY = BRANCH_NAME.match(regex)[0];
}

if (ISSUE_KEY) {
    console.log(`Extracted ISSUE_KEY: ${ISSUE_KEY}`);
    // console.log(`echo "jira_issue_key=${ISSUE_KEY}" >> $GITHUB_OUTPUT`);
    console.log(`::set-output name=jira_issue_key::${ISSUE_KEY}`);
} else {
    console.log("No ISSUE_KEY found in BRANCH_NAME.");
}

/* Check if the PR title starts with ISSUE_KEY followed by ':' */
if (CURRENT_PR_TITLE.startsWith(`${ISSUE_KEY}:`)) {
    console.log(`PR title starts with ISSUE_KEY: ${ISSUE_KEY}`);
    // console.log(`echo "pr_title_starts_with_issue_key=true" >> $GITHUB_OUTPUT`);
    console.log(`::set-output name=pr_title_starts_with_issue_key::true`);
} else {
    console.log(`PR title: ${CURRENT_PR_TITLE}`);
    console.log(`PR title does not start with ISSUE_KEY: ${ISSUE_KEY}`);
    // console.log(`echo "pr_title_starts_with_issue_key=false" >> $GITHUB_OUTPUT`);
    console.log(`::set-output name=pr_title_starts_with_issue_key::false`);
}
