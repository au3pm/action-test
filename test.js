var core = require('@actions/core');
var github = require('@actions/github');

function run() {
  const client = github.GitHub = new github.GitHub(
    core.getInput('GITHUB_TOKEN', {required: true})
  );
  const context = github.context;
  
  if(context.payload.action !== 'opened') {
    console.log('No issue or PR was opened, skipping');
    return;
  }
  
  // Do nothing if its not a pr or issue
  const isIssue = !!context.payload.issue;
  if (!isIssue && !!context.payload.pull_request) {
    console.log(
      'The event that triggered this action was a pull request or not a issue, skipping.'
    );
    return;
  }
  
  if (!context.payload.sender) {
    throw new Error('Internal error, no sender provided by GitHub');
  }
  
  const issue = context.issue;
  
  //console.log('['+Object.keys(client.issues).join(', ')+']');
  
  client.issues.get({
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number
  }).then(response => response.data).then(data => {
    
    const body = data.body.match(/^(.*)$/mg);
    
    const owner = data.user.login;
    const package = data.title;
    const repo = body[0] || package;
    
    client.repos.get({
      owner: owner,
      repo: repo
    }).then(response => response.data).then(data => {
      const version = body[1] || 'FIXME';
      const sha1 = body[2] || 'FIXME';
    
      //`${owner}/${package}`
      console.log(data);


      client.issues.update({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        state: 'closed'
      });

      console.log("done");
    }).catch(e => {
      client.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body: `"${owner}/${repo}": ${e.status}`
      });
      
      client.issues.update({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        state: 'closed'
      });
    });
  });
}

run();
