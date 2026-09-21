import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { needsHumanReview, reviewReason } from '../electron/policy'
import type { ReviewMode } from '../shared/types'

/** Prompts that Auto Review must hold in `sensitive` mode, one per pattern group. */
const HELD = [
  // outbound
  'send the weekly report',
  'email the customer about the delay',
  'slack the team the summary',
  'post the announcement',
  'tweet about the launch',
  'publish the doc',
  // destructive
  'delete the old exports',
  'rm -rf the build dir',
  'drop table users',
  'wipe the cache',
  // money
  'spend $500 on ads',
  'purchase the domain',
  'buy a license',
  'charge the card on file',
  'wire the deposit',
  'transfer funds to savings',
  'invoice the client',
  // production
  'deploy the new build',
  'promote it to production',
  'run it against prod',
  'drop index users_email_idx',
  // privilege
  'grant access to the repository',
  'revoke the api token',
  'make me an admin',
  'run the script with sudo',
]

/** Prompts that must pass through untouched in `sensitive` mode. */
const ALLOWED = [
  'summarize the meeting notes',
  'make a list of the files in the workspace',
  'draft three subject lines for review to consider',
  'who is the sender of this message',
  'the mailbox is nearly full',
  'count the number of indexes',
]

describe('needsHumanReview', () => {
  it('never holds an empty or whitespace-only prompt, in any mode', () => {
    for (const mode of ['always', 'sensitive', 'off'] satisfies ReviewMode[]) {
      assert.equal(needsHumanReview('', mode), false, mode)
      assert.equal(needsHumanReview('   \n\t ', mode), false, mode)
    }
  })

  it('holds every prompt in `always` mode, including a benign one', () => {
    assert.equal(needsHumanReview('summarize the meeting notes', 'always'), true)
    assert.equal(needsHumanReview('say hello', 'always'), true)
  })

  it('holds nothing in `off` mode', () => {
    for (const prompt of HELD) assert.equal(needsHumanReview(prompt, 'off'), false, prompt)
  })

  it('holds sensitive prompts in `sensitive` mode', () => {
    for (const prompt of HELD) assert.equal(needsHumanReview(prompt, 'sensitive'), true, prompt)
  })

  it('lets benign prompts through in `sensitive` mode', () => {
    for (const prompt of ALLOWED) assert.equal(needsHumanReview(prompt, 'sensitive'), false, prompt)
  })

  it('matches whole words only, not substrings', () => {
    assert.equal(needsHumanReview('sender', 'sensitive'), false)
    assert.equal(needsHumanReview('mailbox', 'sensitive'), false)
    assert.equal(needsHumanReview('deleted', 'sensitive'), false)
    // …but the same root as its own word still trips the gate
    assert.equal(needsHumanReview('send it', 'sensitive'), true)
    assert.equal(needsHumanReview('mail it', 'sensitive'), true)
    assert.equal(needsHumanReview('delete it', 'sensitive'), true)
  })

  it('ignores case and surrounding whitespace', () => {
    assert.equal(needsHumanReview('  DELETE EVERYTHING  ', 'sensitive'), true)
    assert.equal(needsHumanReview('Deploy To Production', 'sensitive'), true)
  })

  it('treats any matched pattern as enough', () => {
    assert.equal(needsHumanReview('buy the domain and email the receipt', 'sensitive'), true)
  })
})

describe('reviewReason', () => {
  it('names the matched pattern', () => {
    const reason = reviewReason('delete the old exports')
    assert.ok(reason)
    assert.match(reason, /^Matched sensitive pattern /)
    assert.match(reason, /delete/)
  })

  it('returns undefined when nothing matched', () => {
    assert.equal(reviewReason('summarize the meeting notes'), undefined)
    assert.equal(reviewReason(''), undefined)
  })
})
