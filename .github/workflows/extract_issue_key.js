let ISSUE_KEY;
const regex = new RegExp(`^${PROJECT}-\\d+`);

if (BRANCH_NAME.match(regex)) {
    ISSUE_KEY = BRANCH_NAME.match(regex)[0];
}

if (ISSUE_KEY) {
    console.log(`Extracted ISSUE_KEY: ${ISSUE_KEY}`);
} else {
    console.log(`BRANCH_NAME: ${BRANCH_NAME}`);
    console.log(`PROJECT: ${PROJECT}`);
    console.log(`ISSUE_KEY: ${ISSUE_KEY || 'undefined'}`);
    console.log("No ISSUE_KEY found in BRANCH_NAME.");
}
