const { PathLike, promises } = require('fs');
const github = require('@actions/github');
const core = require('@actions/core');
const yaml = require('js-yaml');

async function load_config() {
	const config = await promises.readFile('./.voting.yml', 'utf8');
	const data = yaml.load(config);
	return data;
}

function get_body({ pr_passing, msg, uniqe_voters, FLAG, voters }) {
	let body = `${FLAG}\n` + `*PR Reviews SUMMARY*\n\n` + `| Name | Vote |\n` + `|--|--|\n`;

	body += Object.entries(voters).reduce((a, [name]) => {
		`| ${name} | ${uniqe_voters[name][0]} |\n`;
	}, '');

	body += `\n${msg}\n`;

	return body;
}

async function main() {
	const FLAG = '<!-- METADATA, DO NOT EDIT OR DELETE, THIS COMMENT WILL BE AUTO-DELETED -->';
	const CONFIG = await load_config();
	core.info(`CONFIG: ${JSON.stringify(CONFIG, null, 2)}`);

	// data store
	const gh_data = {
		token: core.getInput('token'),
		repository: core.getInput('repository'),
		owner: core.getInput('repository').split('/')[0],
		repo: core.getInput('repository').split('/')[1],
		context: github.context,
		payload_action: core.getInput('payloadAction') ? core.getInput('payloadAction') : github.context.payload.action,
		issue_number: core.getInput('issueNumber') ? Number(core.getInput('issueNumber')) : github.context.issue.number,
		server_url: core.getInput('serverURL'),
	};
	core.info(`gh_data: ${JSON.stringify(gh_data, null, 2)}`);

	// init octokit
	const octokit = github.getOctokit(gh_data.token);

	const reviews = await octokit.rest.pulls.listReviews({
		owner: gh_data.owner,
		repo: gh_data.repo,
		pull_number: gh_data.issue_number,
	});
	core.info(`reviews: ${JSON.stringify(reviews, null, 2)}`);

	const uniqe_voters = {};
	let vote_weight = 0;
	let pr_passing = false;
	let msg = "This PR doesn't have enough PR reviews to pass";

	reviews.data.forEach(({ user: { login: username }, state }) => {
		if (Object.keys(CONFIG.voters).includes(username)) {
			if (state === 'APPROVED' || state === 'CHANGES_REQUESTED') {
				uniqe_voters[username] = [state, CONFIG.voters[username]];
			}
		}
	});

	Object.entries(([_, [state, weight]]) => {
		if (state === 'APPROVED') {
			vote_weight += Number(weight);
		}
	});

	if (Object.keys(uniqe_voters).length < CONFIG.min_voters_required) {
		msg = "This PR doesn't have enough PR reviews to pass";
	} else if (vote_weight < CONFIG.weight_to_approve) {
		msg = "This PR doesn't have enough approvals via PR reviews";
	} else if (Object.keys(uniqe_voters).length >= CONFIG.min_voters_required && vote_weight < CONFIG.weight_to_approve) {
		msg = "This PR doesn't have enough approvals via PR reviews";
		// perhaps we close the PR here?
	}

	if (Object.keys(uniqe_voters).length >= CONFIG.min_voters_required && vote_weight >= CONFIG.weight_to_approve) {
		msg = 'The PR is passing PR review conditions. You are free to merge';
		pr_passing = true;
	}

	const body = get_body({ pr_passing, msg, uniqe_voters, FLAG, voters });

	const { data: comments } = await octokit.rest.issues.listComments({
		owner: gh_data.owner,
		repo: gh_data.repo,
		issue_number: gh_data.issue_number,
	});
	core.info(`comments: ${JSON.stringify(comments, null, 2)}`);

	const comments_to_delete = [];
	comments.forEach(({ id, body }) => {
		if (body.startsWith(FLAG)) {
			comments_to_delete.push(id);
		}
	});

	await Promise.all(
		comments_to_delete.map(async (id) => {
			const { data: comments } = await octokit.rest.issues.deleteComment({
				owner: gh_data.owner,
				repo: gh_data.repo,
				comment_id: id,
			});
			core.info(`deleted comment: ${id}`);
		})
	);

	await octokit.rest.issues.createComment({
		owner: gh_data.owner,
		repo: gh_data.repo,
		issue_number: gh_data.issue_number,
		body,
	});
	core.info(`comment created`);

	if (!pr_passing) {
		core.setFailed(msg);
	}
}

try {
	main();
	core.info(`action finished!`);
} catch (error) {
	core.setFailed(error);
}
