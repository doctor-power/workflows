import dotenv from 'dotenv';
dotenv.config();

const BRANCH_NAME = process.env.BRANCH_NAME;
const PROJECT_KEY = process.env.PROJECT_KEY;
const CURRENT_PR_TITLE = process.env.CURRENT_PR_TITLE;
const IS_RELEASE_BRANCH = BRANCH_NAME.startsWith('release');

/* Extract the issue keys from the branch name */
let ISSUE_KEYS;
const regex = new RegExp(`(${PROJECT_KEY}-\\d+)(\\+${PROJECT_KEY}-\\d+)*`, 'g');

if (IS_RELEASE_BRANCH) {
    console.log("Release branch detected. Skipping check for issue key in branch name.");
} else {
    const matches = BRANCH_NAME.match(regex);
    if (matches && matches[0]) {
        ISSUE_KEYS = matches[0].split('+');
    }

    let output;
    if (ISSUE_KEYS && ISSUE_KEYS.length > 0) {
        console.log(`Extracted ISSUE_KEYS: ${ISSUE_KEYS.join(', ')}`);

        if (ISSUE_KEYS.length === 1) {
            output = ISSUE_KEYS[0];
        } else {
            output = `[${ISSUE_KEYS.join(', ')}]`;
        }

        console.log(`::set-output name=jira_issue_key::${output}`);
    } else {
        console.log("No ISSUE_KEYS found in BRANCH_NAME.");
    }
}

/* Check if the PR title starts with the ISSUE_KEYS followed by ':' */
const issueKeysInTitle = (CURRENT_PR_TITLE.match(regex) || []).flatMap(key => key.split('+'));

if (issueKeysInTitle.length > 0) {
    if (!CURRENT_PR_TITLE.startsWith(`${issueKeysInTitle.join('+')}:`)) {
        // Clean up the PR title by removing malformatted issue keys
        let cleanTitle = CURRENT_PR_TITLE;
        issueKeysInTitle.forEach(key => {
            // Remove the key if it appears after any non-word character (like '/' or space)
            // but preserve the separator
            const keyRegex = new RegExp(`(?<=\\W)${key}`, 'gi');
            cleanTitle = cleanTitle.replace(keyRegex, '');
            // Remove the key if it appears at the start
            const startKeyRegex = new RegExp(`^${key}`, 'gi');
            cleanTitle = cleanTitle.replace(startKeyRegex, '');
        });

        // Clean up any orphaned separators (/, spaces) at the start
        cleanTitle = cleanTitle.replace(/^[/\s]+/, '');

        // Format the title properly
        const formattedTitle = `${issueKeysInTitle.join('+')}: ${cleanTitle.trim()}`;
        console.log(`PR title needs formatting. Original: "${CURRENT_PR_TITLE}"`);
        console.log(`Formatted title: "${formattedTitle}"`);
        console.log(`::set-output name=pr_title_valid::false`);
        console.log(`::set-output name=formatted_title::${formattedTitle}`);
    } else if (IS_RELEASE_BRANCH) {
        console.log(`Release branch detected, and PR title starts with issue key(s): [${issueKeysInTitle.join(', ')}]`);
        console.log(`::set-output name=pr_title_valid::true`);
        console.log(`::set-output name=jira_issue_key::${issueKeysInTitle[0]}`);
    } else {
        // If not a release branch, check if the PR title starts with the ISSUE_KEYS from the branch name
        const isExactMatch = issueKeysInTitle.every(key => ISSUE_KEYS.includes(key)) && issueKeysInTitle.length === ISSUE_KEYS.length;

        if (isExactMatch) {
            console.log(`PR title starts with the exact ISSUE_KEYS: [${issueKeysInTitle.join(', ')}]`);
            console.log(`::set-output name=pr_title_valid::true`);
        } else {
            console.log(`PR title contains different ISSUE_KEYS: [${issueKeysInTitle.join(', ')}]`);
            console.log(`::set-output name=pr_title_valid::false`);
            console.log(`::set-output name=pr_title_starts_with_other_issue_key::true`);
        }
    }
} else {
    console.log(`PR title: ${CURRENT_PR_TITLE}`);
    console.log(`PR title does not start with any of the ISSUE_KEYS: ${ISSUE_KEYS && ISSUE_KEYS.length > 0 ? `[${ISSUE_KEYS.join(', ')}]` : ''}`);
    console.log(`::set-output name=pr_title_valid::false`);
}
