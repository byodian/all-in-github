import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  readFileSync(join(root, "scripts/upstream.config.json"), "utf8")
);
const wsl =
  process.platform === "linux" &&
  (Boolean(process.env.WSL_DISTRO_NAME) ||
    /microsoft|wsl/i.test(
      release() +
        (existsSync("/proc/version")
          ? readFileSync("/proc/version", "utf8")
          : "")
    ));

function git(args, cwd = root, allowFailure = false) {
  if (wsl && /build/i.test(["git", ...args, cwd].join(" "))) {
    throw new Error("WSL 禁止执行命令或路径中包含 build 的操作。");
  }
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_MERGE_AUTOEDIT: "no" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `git ${args.join(" ")} 失败。\n${result.stderr || result.stdout}`
    );
  }
  return result;
}

function value(args, cwd = root) {
  return git(args, cwd).stdout.trim();
}

function output(values) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, item]) => `${key}=${item}\n`)
        .join("")
    );
  }
}

try {
  const { values } = parseArgs({
    options: {
      "base-ref": { type: "string" },
      "source-ref": { type: "string" },
      worktree: { type: "string" },
    },
  });
  const base = value([
    "rev-parse",
    "--verify",
    `${values["base-ref"] || config.baseBranch}^{commit}`,
  ]);
  const sourceRef = values["source-ref"] || config.sourceRef;
  if (!/^refs\/(heads|tags)\//.test(sourceRef)) {
    throw new Error("来源必须为完整的 refs/heads/... 或 refs/tags/... 引用。");
  }
  git(["fetch", "--no-tags", config.repository, sourceRef]);
  const source = value(["rev-parse", "FETCH_HEAD^{commit}"]);
  console.log(
    `Fork 基线：${base}\n上游来源：${sourceRef}\n上游提交：${source}`
  );
  const integrated = git(
    ["merge-base", "--is-ancestor", source, base],
    root,
    true
  );
  if (integrated.status === 0) {
    output({ changed: "false", base, source });
    console.log("上游提交已合并，无需更新。");
  } else {
    if (integrated.status !== 1) throw new Error(integrated.stderr);
    const branch = `chore/sync-upstream-${source.slice(0, 12)}-${base.slice(0, 12)}`;
    const commonDir = value([
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    const worktree = resolve(
      values.worktree ||
        join(commonDir, "upstream-sync", branch.slice("chore/".length))
    );
    mkdirSync(dirname(worktree), { recursive: true });
    git(["worktree", "add", "-b", branch, worktree, base]);
    // Publish the worktree location before merging so CI can preserve a failed merge.
    output({ changed: "true", base, source, branch, worktree });
    console.log(`同步分支：${branch}\n工作目录：${worktree}`);
    try {
      const merge = git(
        ["merge", "--no-ff", "--no-commit", source],
        worktree,
        true
      );
      if (
        merge.status !== 0 &&
        git(["rev-parse", "--verify", "MERGE_HEAD"], worktree, true).status !==
          0
      ) {
        throw new Error(merge.stderr || merge.stdout);
      }
      // Restore personal content even if Git merged it without a conflict.
      for (const path of config.protectedPaths) {
        if (value(["ls-tree", "--name-only", base, "--", path], worktree)) {
          git(
            [
              "restore",
              `--source=${base}`,
              "--staged",
              "--worktree",
              "--",
              path,
            ],
            worktree
          );
        } else {
          git(["rm", "-r", "-f", "--ignore-unmatch", "--", path], worktree);
        }
      }
      const conflicts = value(
        ["diff", "--name-only", "--diff-filter=U"],
        worktree
      );
      if (conflicts) throw new Error(`源码冲突需要手动处理：\n${conflicts}`);
      git(
        [
          "diff",
          "--cached",
          "--exit-code",
          base,
          "--",
          ...config.protectedPaths,
        ],
        worktree
      );
      const report = join(worktree, "docs/upstream-sync-latest.md");
      mkdirSync(dirname(report), { recursive: true });
      writeFileSync(
        report,
        `# 最近一次上游同步\n\n维护者：${value(["config", "user.name"])}\n\n` +
          `- 来源：${config.repository}，\`${sourceRef}\`\n- Fork 基线：\`${base}\`\n- 上游提交：\`${source}\`\n` +
          `- 方式：普通 merge，保留上游祖先关系。\n- 受保护路径：与 Fork 基线逐字节一致。\n- 验证结果：请查看对应 Actions 运行；本文件记录合并准备，不代表检查通过。\n\n` +
          "```text\n" +
          value(["diff", "--cached", "--stat", base], worktree) +
          "\n```\n"
      );
      git(["add", "--", "docs/upstream-sync-latest.md"], worktree);
      git(["commit", "--no-edit"], worktree);
      git(
        ["diff", "--exit-code", base, "HEAD", "--", ...config.protectedPaths],
        worktree
      );
      git(["diff", "--check", base, "HEAD"], worktree);
      output({ report });
      console.log(`合并准备完成，尚未执行验证或推送。\n摘要：${report}`);
    } catch (error) {
      throw new Error(
        `${error.message}\n已保留工作目录：${worktree}\n解决冲突并暂存后执行 git commit --no-edit，再完成验证。`
      );
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
