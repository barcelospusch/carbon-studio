'use strict';

const repository = 'https://github.com/barcelospusch/carbon-studio';
const endpoint = 'https://api.github.com/repos/barcelospusch/carbon-studio/releases/latest';
const stableTag = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const installedVersion = /^(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(?:\+[\w.-]+)?$/;

async function checkUpdate(version) {
  try {
    const current = installedVersion.exec(version);
    if (!current) return null;
    const response = await fetch(endpoint, {
      headers:{Accept:'application/vnd.github+json','User-Agent':'Carbon-Studio'},
      signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const release = await response.json();
    if (release.draft || release.prerelease || !release.published_at) return null;
    const latest = stableTag.exec(release.tag_name);
    if (!latest) return null;
    const order = [1,2,3].map(index => BigInt(latest[index]) - BigInt(current[index])).find(Boolean);
    if (order === undefined ? !current[4] : order < 0n) return null;
    return {version:latest.slice(1,4).join('.'), url:repository+'/releases/tag/'+latest[0]};
  } catch {
    return null;
  }
}

module.exports = {checkUpdate, repository};
