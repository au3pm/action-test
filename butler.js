const exit = require('process').exit;
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const node_path = require('path');

class PackageError extends Error {}

async function run() {
  const token = core.getInput('GITHUB_TOKEN', {required: true});
  
  const octokit = github.getOctokit(token);
  const context = github.context;
  
  if(context.payload.action !== 'opened' && context.payload.action !== 'labeled') {
    console.log('No issue or PR was opened, skipping');
    exit(1);
    return;
  }
  
  // Do nothing if its not a pr or issue
  const isIssue = !!context.payload.issue;
  if (!isIssue && !!context.payload.pull_request) {
    console.log('The event that triggered this action was a pull request or not a issue, skipping.');
    return;
  }
  
  if (!context.payload.sender) throw new Error('Internal error, no sender provided by GitHub');
  
  const issue = context.issue;
  
  await octokit.rest.issues.get({
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number
  }).then(response => response.data).then(async data => {
    
    if (context.payload.action === 'labeled') {
      if (data.labels.find(label => label.name === 'package') === undefined) {
        console.log('The issue label triggering this action was not "package"');
        exit(1);
      }
      await octokit.rest.issues.deleteLabel({
        owner: issue.owner,
        repo: issue.repo,
        name: 'package',
      });
    }
    
    const body = data.body.match(/^(.*)$/mg);
    
    const issueOwner = data.user.login;
    
    const packageName = data.title;
    const [packageOwner, packageRepository, packageVersion, packageSha] = body;

    //const owner = data.user.login;
    //const package = data.title;
    if (!/^[a-zA-Z -_0-9]+$/.test(packageName) || !packageName.trim()) {
      throw new PackageError(`Invalid package name: ${packageName}`);
    }
    
    //FIXME: validate that issueOwner are associated with the packageOwner/packageRepository, like organisations
    
    octokit.rest.repos.get({
      owner: packageOwner,
      repo: packageRepository
    }).then(response => response.data).then(async data => {
      //TODO: if fork, maybe do something, to try and avoid people copying packages under another name, with no diff?
      let path = 'au3pm.json';
      const directory = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
      const packageExists = directory.hasOwnProperty(packageName);
      const formattedPackage = packageName.replace(/ /g, '_');
      
      //FIXME: if taken, generate a folder name
      if (!packageExists && fs.existsSync(`./${formattedPackage}/`)) {
        throw new PackageError(`Package name already taken: ${packageName}`);
      }
      
      let sha1 = packageSha || await octokit.rest.repos.listCommits({owner: packageOwner, repo: packageRepository, per_page: 1}).then(response => response.data[0].sha).catch(false);
      if (packageSha) {
        sha1 = octokit.rest.repos.listCommits({owner: packageOwner, repo: packageRepository, per_page: 1, sha: packageSha}).then(response => response.data[0].sha).catch(e => false);
      }
      
      if (!packageExists) {
        directory[packageName] = formattedPackage;
        fs.writeFileSync(path, JSON.stringify(directory));
      }
      
      path = `./${directory[packageName] || formattedPackage}/au3pm.json`;
      
      const packageDirectory = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {repo: data.full_name, versions: {}};
      const fIncrement = v => {let a = v.split(".");a[1]++;return a.join(".");};
      const version = packageVersion || (packageExists ? fIncrement(Object.keys(packageDirectory.versions).sort().reverse()[0] || "1.0.0") : "1.0.0");
      const versionExists = directory.hasOwnProperty(version);
      //FIXME: use regex from repo web page.
      const validVersion = /^[0-9]+.[0-9]+.[0-9]+$/.test(version);//TODO: if !valid, do not calc sha1 or load more files. (throw an error or something)
    
      if (!versionExists) {
        if (!fs.existsSync(node_path.dirname(path) + '/')) {fs.mkdirSync(node_path.dirname(path) + '/', {recursive: true})}
        packageDirectory.versions[version] = sha1;
        fs.writeFileSync(path, JSON.stringify(packageDirectory));
      }
      // console.log(data);
      
      octokit.rest.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body: `:heavy_check_mark: "${packageOwner}/${packageRepository}" => ${packageName}`
      });

      octokit.rest.issues.update({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        state: 'closed'
      });

      console.log("done");
    }).catch(e => {
      console.error(e);
      
      octokit.rest.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body: e instanceof PackageError ? `:x: "${packageOwner}/${packageRepository}": ${e.message}` : `:heavy_exclamation_mark: "${packageOwner}/${packageRepository}": ${e.status || 'internal error occured'}`
      }).then(() => {
        octokit.rest.issues.update({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.number,
          state: 'closed'
        }).then(() => {
          exit(1);
        });
      });
    });
  });
}

run();
