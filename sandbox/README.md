# OpenCode Sandbox Kit

This directory defines the Docker Sandbox Kit used to run OpenCode for this project.

## Host setup

Before creating the sandbox, configure required credentials on the host.

### GitHub

Authenticate the GitHub CLI:

```bash
gh auth login
```

Then expose the existing GitHub token to Docker Sandboxes:

```bash
sbx secret set github --command 'gh auth token'
```

Docker resolves the token through the host `gh` command, so the token does not need to be stored in the repository or shell history.

### OpenCode Zen

Register the OpenCode Zen API key interactively:

```bash
sbx secret set-custom \
  --host opencode.ai \
  --env OPENCODE_API_KEY
```

Enter the API key when prompted.

Do not pass the token with `--value` or assign it in the shell, as that can leave the secret in shell history or process metadata.

These credentials are host-local and must be configured separately by each developer. They are not stored in the kit or repository.

## Create and run the sandbox

From the repository root:

```bash
sbx run --clone ./sandbox/opencode-kit --name warlord
```

This can take long time for the first time.


Later use

```bash
sbx run --name warlord -- --continue
```

to continue the session

`sbx` builds the local kit and uses the current directory as the sandbox workspace.

### Troubleshooting
You may need to install `docker-buildx` to use sbx spec kit.

If you get error similar to:
```
OCI exporter is not supported for the docker driver. Switch to a different driver, or turn on the containerd image store, and try again.
```

Fetch buildx docker-container driver.

```
docker buildx create \
  --name sbx-builder \
  --driver docker-container \
  --use \
  --bootstrap
```

## Reconnect

Once the sandbox exists:

```bash
sbx run --name warlord
```

## Rebuild after kit changes

To apply changes
