import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { tool_input: input } = JSON.parse(readFileSync(0, 'utf8'));

// Only approve a single existing local branch to origin. Other forms, including
// implicit pushes, custom destinations and compound shell commands, use normal permissions.
const push = /^git push (?:-u |--set-upstream )?origin ([a-zA-Z0-9_][a-zA-Z0-9_./-]*)$/u.exec(
  input?.command ?? '',
);
const branch = push?.[1];
if (branch && branch !== 'main' && !branch.startsWith('refs/')) {
  const localBranch = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
  const pushMapping = spawnSync('git', ['config', '--get-all', 'remote.origin.push']);
  const followTags = spawnSync('git', ['config', '--type=bool', '--get', 'push.followTags'], {
    encoding: 'utf8',
  });
  // A configured push mapping can send the branch to a destination with a different name.
  if (
    localBranch.status === 0 &&
    pushMapping.status === 1 &&
    (followTags.status === 1 || followTags.stdout?.trim() === 'false')
  ) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'Push explícito a una rama distinta de main.',
        },
      }),
    );
  }
}
