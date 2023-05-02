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
	core.info(`CONFIG: ${JSON.stringify(CONFIG, null, '\n')}`);

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
	core.info(`Inputs: ${JSON.stringify(gh_data, null, '\n')}`);

	const octokit = github.getOctokit(gh_data.token);

	const reviews = await octokit.rest.pulls.listReviews({
		owner: gh_data.owner,
		repo: gh_data.repo,
		pull_number: gh_data.issue_number,
	});
	core.info(`reviews: ${JSON.stringify(reviews, null, '\n')}`);

	const { data: comments } = await octokit.rest.pulls.listComments({
		owner: gh_data.owner,
		repo: gh_data.repo,
		pull_number: gh_data.issue_number,
	});
	core.info(`comments: ${JSON.stringify(comments, null, '\n')}`);
}

try {
	main();
	core.info(`Action finished!`);
} catch (error) {
	core.setFailed(error);
}
