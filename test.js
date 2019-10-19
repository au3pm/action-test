var core = require('@actions/core');
var github = require('@actions/github');

function run() {
  const client = github.GitHub = new github.GitHub(
    core.getInput('repo-token', {required: true})
  );
  const context = github.context;
  
  if(context.payload.action !== 'opened') {
    console.log('No issue or PR was opened, skipping');
    return;
  }
  
  // Do nothing if its not a pr or issue
  const isIssue = !!context.payload.issue;
  if (!isIssue && !context.payload.pull_request) {
    console.log(
      'The event that triggered this action was not a pull request or issue, skipping.'
    );
    return;
  }
  
  if (!context.payload.sender) {
    throw new Error('Internal error, no sender provided by GitHub');
  }
  
  const issue = context.issue;
  
  await client.issues.close({
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number,
    body: 'test'
  });
  
  console.log("done");
}

run();
