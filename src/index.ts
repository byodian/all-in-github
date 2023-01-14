import { Octokit } from 'octokit'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device'
import type { Verification } from '@octokit/auth-oauth-device/dist-types/types'
import { bumpBoopCounter } from './utils'

// https://github.com/octokit/auth-oauth-device.js#readme
const MyOctokit = Octokit.plugin(createOrUpdateTextFile).defaults({
  userAgent: 'All In Github',
})

const octokit = new MyOctokit({
  authStrategy: createOAuthDeviceAuth,
  auth: {
    clientType: 'oauth-app',
    clientId: '3063e6354c17317ab9ae',
    scopes: ['public_repo'],
    onVerification(verification: Verification) {
      // verification example
      // {
      //   device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5",
      //   user_code: "WDJB-MJHT",
      //   verification_uri: "https://github.com/login/device",
      //   expires_in: 900,
      //   interval: 5,
      // };

      console.log('Open %s', verification.verification_uri)
      console.log('Enter code: %s', verification.user_code)
    },
  },
  // auth: process.env.GITHUB_TOKEN,
})

async function run() {
  const { data: user } = await octokit.request('GET /user')

  console.log(`authenticated as ${user.login}`)

  // https://github.com/octokit/plugin-create-or-update-text-file.js/#readme
  // get the README
  try {
    await octokit.createOrUpdateTextFile({
      owner: 'byodian',
      repo: 'all-in-github',
      path: 'README.md',
      message: 'BOOP',
      content: ({ content }) => {
        return bumpBoopCounter(content)
      },
    })

    console.log('README file have been updated!')
  }
  catch (error) {
    const { data: issue }: any = await octokit
      .request('POST /repos/{owner}/{repo}/issues', {
        owner: 'byodian',
        repo: 'all-in-github',
        title: 'new issue',
        body: 'A new issue is created by a bot',
      })
      .catch((err) => {
        console.log(err)
      })

    console.dir(`issue created at ${issue.html_url}`)
  }

  // this is the long way
  // const { data: readme } = await octokit.request(
  //   'GET /repos/{owner}/{repo}/contents/{path}',
  //   {
  //     owner: 'byodian',
  //     repo: 'byodian',
  //     path: 'README.md',
  //   },
  // );

  // const updated = bumpBoopCounter(nodeBase64ToUtf8(readme.content));

  // console.log(updated);

  // const response = await octokit.request(
  //   'PUT /repos/{owner}/{repo}/contents/{path}',
  //   {
  //     owner: 'byodian',
  //     repo: 'byodian',
  //     path: 'README.md',
  //     message: 'BOOP',
  //     content: nodeUtf8ToBase64(updated),
  //     sha: readme.sha,
  //   },
  // );

  // console.dir(response.data);
}

run()
