const { PathLike, promises } = require('fs');
const github = require('@actions/github');
const core = require('@actions/core');
const yaml = require('js-yaml');

async function load_config() {
	const config = await promises.readFile('./.voting.yml', 'utf8');
	const data = yaml.load(config);
	return data;
}

async function main() {
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

	// generate comment body
	// get all comments
	// delete all old comments
	// add new comment

	const { data: comments } = await octokit.rest.issues.listComments({
		owner: gh_data.owner,
		repo: gh_data.repo,
		issue_number: gh_data.issue_number,
	});
	core.info(`comments: ${JSON.stringify(comments, null, 2)}`);
}

try {
	main();
	core.info(`Action finished!`);
} catch (error) {
	core.setFailed(error);
}
