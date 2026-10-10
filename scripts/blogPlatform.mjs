export function detectWsl(platform, environment, kernelVersion) {
  return (
    platform === 'linux' &&
    (Boolean(environment.WSL_DISTRO_NAME) ||
      /microsoft|wsl/i.test(kernelVersion))
  )
}

export function verificationSteps(wsl) {
  return [
    ['install', '--frozen-lockfile', ...(wsl ? ['--ignore-scripts'] : [])],
    ['exec', 'astro', 'check'],
    ['exec', 'eslint', '.'],
    ['exec', 'prettier', '--check', '.'],
    ...(wsl
      ? []
      : [
          ['exec', 'astro', 'build'],
          ['exec', 'pagefind', '--site', 'dist'],
        ]),
  ]
}
