import dotenv from 'dotenv';
dotenv.config();

const BRANCH_NAME = process.env.BRANCH_NAME;
const PROJECT_KEY = process.env.PROJECT_KEY;
const CURRENT_PR_TITLE = process.env.CURRENT_PR_TITLE;
const IS_RELEASE_BRANCH = BRANCH_NAME.startsWith('release');

/* Extract the issue keys from the branch name */
let ISSUE_KEYS;
const regex = new RegExp(`(${PROJECT_KEY}-?\\d+)(\\+${PROJECT_KEY}-?\\d+)*`, 'g');

// Extract issue keys from branch name, allowing for optional hyphens and case-insensitive matching
const caseInsensitiveRegex = new RegExp(`(${PROJECT_KEY}-?\\d+)(\\+${PROJECT_KEY}-?\\d+)*`, 'gi');

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
        // if issueKeysInTitle is not followed by a colon in CURRENT_PR_TITLE, pr_title_valid = false
        console.log(`PR title does not start with issue key(s) followed by a colon. PR title: ${CURRENT_PR_TITLE});]`);
        console.log(`::set-output name=pr_title_valid::false`);
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

/* Clean PR title by removing duplicate issue keys and ensuring proper format */
function cleanPRTitle(title) {
    // First, extract the issue keys if they exist at the start followed by a colon
    const startsWithKey = title.match(new RegExp(`^(${PROJECT_KEY}-?\\d+)(\\+${PROJECT_KEY}-?\\d+)*:`, 'i'));

    // Remove any occurrence of the issue key (case insensitive) from the rest of the title
    let cleanedTitle = title;
    if (startsWithKey) {
        // Get the description part after the colon
        cleanedTitle = title.substring(startsWithKey[0].length).trim();
    } else {
        // Extract first occurrence of any issue key
        const keyMatch = title.match(caseInsensitiveRegex);
        if (keyMatch) {
            // Remove the found key from the title
            cleanedTitle = title.replace(keyMatch[0], '').trim();
            // Remove common separators that might be left over
            cleanedTitle = cleanedTitle.replace(/^[/\\: ]/, '').trim();
        }
    }

    // Remove any remaining occurrences of the issue key, including variations with and without hyphen
    const keyToRemove = new RegExp(`${PROJECT_KEY}[-\\s]?\\d+`, 'gi');
    cleanedTitle = cleanedTitle.replace(keyToRemove, '').trim();

    // Format the title with the uppercase issue key, ensuring proper hyphen format
    let issueKey = title.match(regex)?.[0]?.toUpperCase() || title.match(caseInsensitiveRegex)?.[0]?.toUpperCase();
    if (issueKey) {
        // Ensure the issue key has a hyphen
        issueKey = issueKey.replace(/([A-Z]+)(?!-)(\d+)/, '$1-$2');
        return `${issueKey}: ${cleanedTitle}`;
    }
    return title;
}

const cleanedTitle = cleanPRTitle(CURRENT_PR_TITLE);
console.log(`::set-output name=cleaned_pr_title::${cleanedTitle}`);
