var core = require('@actions/core');
var github = require('@actions/github');
const fs = require('fs');

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
  
  client.issues.get({
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number
  }).then(response => response.data).then(data => {
    
    const body = data.body.match(/^(.*)$/mg);
    
    const owner = data.user.login;
    const package = data.title;
    //TODO: validate package
    //TODO: if package does not exist, check directory agenst folder name conflicts. and generate a new if true.
    const repo = body[0] || package;
    
    client.repos.get({
      owner: owner,
      repo: repo
    }).then(response => response.data).then(data => {
      //TODO: if fork, maybe do something, to try and avoid people copying packages under another name, with no diff?
      let path = 'au3pm.js';
      const directory = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
      const packageExists = directory.hasOwnProperty(package);
      
      const version = body[1] || (packageExists ? 'FIXME: increment minor version' : "1.0.0");
      const validVersion = /^[0-9]+.[0-9]+.[0-9]+$/.test(version);//TODO: if !valid, do not calc sha1 or load more files. (throw an error or something)
      let sha1 = body[2] || await client.repos.listCommits({owner: owner, repo: repo, per_page: 1}).then(response => response.data[0].sha).catch(false);
      if (body[2]) {
        sha1 = client.repos.listCommits({owner: owner, repo: repo, per_page: 1, sha: body[2]}).then(response => response.data[0].sha).catch(e => false);
      }
      
      path = `./${}/au3pm.js`;
      const packageDirectory = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
      const versionExists = directory.hasOwnProperty(version);
    
      //`${owner}/${package}`
      console.log(data);
      
      client.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body: `"${owner}/${repo}" => ${package}`
      });

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
