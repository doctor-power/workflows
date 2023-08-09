import dotenv from 'dotenv';
dotenv.config();

const BRANCH_NAME = process.env.BRANCH_NAME;
const PROJECT_KEY = process.env.PROJECT_KEY;

let ISSUE_KEY;
const regex = new RegExp(`^${PROJECT_KEY}-\\d+`);

if (BRANCH_NAME.match(regex)) {
    ISSUE_KEY = BRANCH_NAME.match(regex)[0];
}

if (ISSUE_KEY) {
    console.log(`Extracted ISSUE_KEY: ${ISSUE_KEY}`);
    console.log(`echo "jira_issue_key=${ISSUE_KEY}" >> $GITHUB_OUTPUT`);
} else {
    console.log(`BRANCH_NAME: ${BRANCH_NAME}`);
    console.log(`PROJECT: ${PROJECT_KEY}`);
    console.log(`ISSUE_KEY: ${ISSUE_KEY || 'undefined'}`);
    console.log("No ISSUE_KEY found in BRANCH_NAME.");
}
