#!/usr/bin/env python3
"""Publish a Note blog post by creating or updating a GitHub issue comment."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from typing import Any


def run_gh(args: list[str], *, input_text: str | None = None) -> str:
    result = subprocess.run(
        ["gh", *args],
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip()
        raise SystemExit(f"gh {' '.join(args)} failed: {message}")
    return result.stdout.strip()


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def read_body(path: str) -> str:
    if path == "-":
        return sys.stdin.read().strip()
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read().strip()


def format_comment(title: str, description: str, tags: list[str], body: str) -> str:
    return "\n".join(
        [
            f"<!-- title:  {title.strip()}  -->",
            f"<!-- tags:  {', '.join(tags)}  -->",
            f"<!-- description:  {description.strip()}  -->",
            "",
            body.strip(),
            "",
        ]
    )


def issue_labels(issue: dict[str, Any]) -> set[str]:
    return {label["name"] for label in issue.get("labels", [])}


def find_issue(repo: str, labels: list[str]) -> int | None:
    payload = run_gh(
        [
            "issue",
            "list",
            "--repo",
            repo,
            "--state",
            "open",
            "--label",
            "Note",
            "--limit",
            "100",
            "--json",
            "number,title,labels",
        ]
    )
    issues = json.loads(payload or "[]")
    required = set(labels)
    matches = [
        issue
        for issue in issues
        if required.issubset(issue_labels(issue))
    ]
    if len(matches) > 1:
        summary = ", ".join(f"#{issue['number']} {issue['title']}" for issue in matches)
        raise SystemExit(f"multiple matching Note issues found: {summary}; pass --issue")
    if not matches:
        return None
    return int(matches[0]["number"])


def get_issue(repo: str, issue_number: int) -> dict[str, Any]:
    payload = run_gh(
        [
            "issue",
            "view",
            str(issue_number),
            "--repo",
            repo,
            "--json",
            "number,title,labels,state",
        ]
    )
    issue = json.loads(payload)
    labels = issue_labels(issue)
    if "Note" not in labels:
        raise SystemExit(f"issue #{issue_number} is missing the Note label")
    if issue.get("state") != "OPEN":
        raise SystemExit(f"issue #{issue_number} is not open")
    return issue


def create_issue(repo: str, title: str, labels: list[str]) -> int:
    args = [
        "issue",
        "create",
        "--repo",
        repo,
        "--title",
        title,
        "--body",
        "Container issue for Note blog comments.",
        "--label",
        "Note",
    ]
    for label in labels:
        args.extend(["--label", label])
    output = run_gh(args)
    issue_url = output.splitlines()[-1]
    return int(issue_url.rstrip("/").split("/")[-1])


def ensure_labels(repo: str, issue_number: int, labels: list[str]) -> None:
    issue = get_issue(repo, issue_number)
    missing = [label for label in labels if label not in issue_labels(issue)]
    if missing:
        run_gh(
            [
                "issue",
                "edit",
                str(issue_number),
                "--repo",
                repo,
                "--add-label",
                ",".join(missing),
            ]
        )


def post_comment(repo: str, issue_number: int, body: str) -> str:
    endpoint = f"repos/{repo}/issues/{issue_number}/comments"
    payload = json.dumps({"body": body}, ensure_ascii=False)
    response = run_gh(["api", endpoint, "--method", "POST", "--input", "-"], input_text=payload)
    return json.loads(response)["html_url"]


def update_comment(repo: str, comment_id: str, body: str) -> str:
    endpoint = f"repos/{repo}/issues/comments/{comment_id}"
    payload = json.dumps({"body": body}, ensure_ascii=False)
    response = run_gh(["api", endpoint, "--method", "PATCH", "--input", "-"], input_text=payload)
    return json.loads(response)["html_url"]


def watch_latest_build_note(repo: str) -> None:
    time.sleep(8)
    payload = run_gh(
        [
            "run",
            "list",
            "--repo",
            repo,
            "--workflow",
            "build-note.yml",
            "--limit",
            "1",
            "--json",
            "databaseId,status,conclusion,displayTitle,createdAt",
        ]
    )
    runs = json.loads(payload or "[]")
    if not runs:
        raise SystemExit("no build-note.yml workflow run found")
    run_id = str(runs[0]["databaseId"])
    print(f"Watching build-note.yml run {run_id}")
    run_gh(["run", "watch", run_id, "--repo", repo, "--exit-status"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="byodian/all-in-github")
    parser.add_argument("--issue", type=int)
    parser.add_argument("--issue-title")
    parser.add_argument("--category-label", action="append", default=[])
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--tags", required=True, help="Comma-separated post tags")
    parser.add_argument("--body-file", required=True, help="Markdown file path, or - for stdin")
    parser.add_argument("--comment-id", help="Existing GitHub issue comment ID to update")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--watch", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    category_labels = [label.strip() for label in args.category_label if label.strip()]
    tags = split_csv(args.tags)
    if not tags:
        raise SystemExit("--tags must include at least one tag")

    body = read_body(args.body_file)
    if not body:
        raise SystemExit("--body-file must not be empty")

    comment_body = format_comment(args.title, args.description, tags, body)
    if args.dry_run:
        print(comment_body, end="")
        return

    issue_number = args.issue
    if issue_number is None:
        issue_number = find_issue(args.repo, category_labels)
    if issue_number is None:
        if not args.issue_title:
            raise SystemExit("no matching Note issue found; pass --issue or --issue-title")
        issue_number = create_issue(args.repo, args.issue_title, category_labels)
    else:
        ensure_labels(args.repo, issue_number, category_labels)

    if args.comment_id:
        url = update_comment(args.repo, args.comment_id, comment_body)
        print(f"Updated comment: {url}")
    else:
        url = post_comment(args.repo, issue_number, comment_body)
        print(f"Created comment: {url}")

    if args.watch:
        watch_latest_build_note(args.repo)


if __name__ == "__main__":
    main()
