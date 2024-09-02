// Adapted from https://github.com/dc-ag/auto-assign-reviewers-from-team/blob/main/src/main.ts
// to allow excluding specific team members from the list of potential reviewers
import * as core from "@actions/core";
import * as github from "@actions/github";

async function run() {
  try {
    const repoToken = process.env.GITHUB_TOKEN;
    const ORG_TEAM_MEMBERS = process.env.ORG_TEAM_MEMBERS;
    const team = process.env.GITHUB_TEAM.toLowerCase();
    const amount = parseInt(process.env.AMOUNT);
    const excludeMembers = process.env.EXCLUDE_MEMBERS
      ? process.env.EXCLUDE_MEMBERS.split(",")
      : [];

    const issue = github.context.issue;

    console.log("team: ", team);

    if (!issue || !issue.number) {
      console.log("No pull request context, skipping!");
      return;
    }

    const ghOrg = github.context.repo.owner;
    const octokit = github.getOctokit(repoToken);

    const pullRequest = await octokit.rest.pulls.get({
      owner: issue.owner,
      repo: issue.repo,
      pull_number: issue.number,
    });

    if (!pullRequest) {
      console.log("Pull request not found, skipping!");
      return;
    }

    // const members = await octokit.rest.teams.listMembersInOrg({
    //   org: ghOrg,
    //   team_slug: team,
    // });

    const members = await octokit.request(`GET /orgs/${ghOrg}/teams/${team}/members`, {
      org: ghOrg,
      team_slug: team,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `token ${ORG_TEAM_MEMBERS}`
      }
    })

    // const getRedirectedUrl = async (url) => {
    //   const response = await fetch(url, {
    //     method: 'HEAD',
    //     headers: {
    //       'Authorization': `token ${ORG_TEAM_MEMBERS}`
    //     },
    //     redirect: 'follow'
    //   });
    //   return response.url;
    // };

    let memberNames = members.data.map((a) => a.login);

    // Exclude PR author and members from the exclude list
    memberNames = memberNames.filter(
      (name) =>
        name !== pullRequest.data.user?.login &&
        !excludeMembers.includes(name)
    );

    console.log(`Picking ${amount} reviewer(s) from members: `, memberNames);

    let finalReviewers = [];

    if (amount === 0 || memberNames.length <= amount) {
      finalReviewers = memberNames;
    } else {
      memberNames = shuffle(memberNames);
      for (let i = 0; i < amount; i++) {
        const name = memberNames.pop();
        if (name !== undefined) {
          finalReviewers.push(name);
        }
      }
    }

    if (finalReviewers.length > 0) {
      const reviewerResponse = await octokit.rest.pulls.requestReviewers({
        owner: issue.owner,
        repo: issue.repo,
        pull_number: issue.number,
        reviewers: finalReviewers,
      });
      console.log(
        `Request Status for assigning reviewers: ${reviewerResponse.status}`
      );
      console.log(
        `Reviewers from Team '${team}' for PR ${issue.number}: ${reviewerResponse?.data?.requested_reviewers
          ?.map((r) => r.login)
          .join(",")}`
      );
      console.log("... success!");
    } else {
      console.log(`No members to assign found in team ${team}`);
    }
  } catch (error) {
    console.error(error);
    core.setFailed(`Error: ${error}`);
    throw error;
  }
}

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

run();
