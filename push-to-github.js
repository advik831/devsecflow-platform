import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    
    // Skip common directories and files that shouldn't be in the repository
    if (file.startsWith('.') || 
        file === 'node_modules' || 
        file === 'dist' || 
        file === 'build' ||
        file === 'scripts') {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function createGitHubRepository() {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Get authenticated user
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);

    // Create repository
    const repoName = 'devsecflow-platform';
    console.log(`Creating repository: ${repoName}`);
    
    let repo;
    try {
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'DevSecFlow - Comprehensive DevOps/DevSecOps lifecycle management platform',
        private: false,
        auto_init: false
      });
      repo = data;
      console.log(`Repository created: ${repo.html_url}`);
    } catch (error) {
      if (error.status === 422) {
        // Repository already exists, get it
        const { data } = await octokit.rest.repos.get({
          owner: user.login,
          repo: repoName
        });
        repo = data;
        console.log(`Repository already exists: ${repo.html_url}`);
      } else {
        throw error;
      }
    }

    // Get all files to upload
    const files = getAllFiles('.');
    console.log(`Found ${files.length} files to upload`);

    // Create tree for all files
    const tree = [];
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = filePath.replace(/^\.\//, '');
      
      tree.push({
        path: relativePath,
        mode: '100644',
        type: 'blob',
        content: content
      });
    }

    console.log('Creating git tree...');
    const { data: gitTree } = await octokit.rest.git.createTree({
      owner: user.login,
      repo: repoName,
      tree: tree
    });

    // Get current HEAD commit if it exists
    let parentSha = null;
    try {
      const { data: currentRef } = await octokit.rest.git.getRef({
        owner: user.login,
        repo: repoName,
        ref: 'heads/main'
      });
      parentSha = currentRef.object.sha;
      console.log(`Found existing main branch with commit: ${parentSha}`);
    } catch (error) {
      if (error.status === 404) {
        console.log('No existing main branch found, creating initial commit');
      } else {
        throw error;
      }
    }

    console.log('Creating commit...');
    const commitParams = {
      owner: user.login,
      repo: repoName,
      message: 'Update: DevSecFlow platform with authentication system and UI fixes',
      tree: gitTree.sha
    };
    
    if (parentSha) {
      commitParams.parents = [parentSha];
    }

    const { data: commit } = await octokit.rest.git.createCommit(commitParams);

    console.log('Updating main branch...');
    try {
      if (parentSha) {
        // Update the existing main branch
        await octokit.rest.git.updateRef({
          owner: user.login,
          repo: repoName,
          ref: 'heads/main',
          sha: commit.sha
        });
      } else {
        // Create new main branch
        await octokit.rest.git.createRef({
          owner: user.login,
          repo: repoName,
          ref: 'refs/heads/main',
          sha: commit.sha
        });
      }
    } catch (error) {
      throw error;
    }

    console.log('✅ Successfully pushed all source code to GitHub!');
    console.log(`🔗 Repository URL: ${repo.html_url}`);
    console.log(`📁 Files uploaded: ${files.length}`);
    
    return repo;

  } catch (error) {
    console.error('❌ Error pushing to GitHub:', error);
    throw error;
  }
}

// Run the script
createGitHubRepository()
  .then((repo) => {
    console.log('\n🎉 All done! Your code has been pushed to GitHub.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to push code to GitHub:', error.message);
    process.exit(1);
  });