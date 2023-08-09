#!/bin/bash

BRANCH_NAME="WA-24_my-branch-name"
PROJECT="WA"

ISSUE_KEY=$(echo $BRANCH_NAME | grep -oE "^$PROJECT-\d+")

if [[ -n $ISSUE_KEY ]]; then # if $ISSUE_KEY is not empty
    echo "Extracted ISSUE_KEY: $ISSUE_KEY"
else
    echo "No ISSUE_KEY found in BRANCH_NAME."
fi
