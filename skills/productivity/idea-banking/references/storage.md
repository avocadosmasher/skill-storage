# 저장 형식과 실행

Python 3.10 이상을 사용한다. 아래 `SKILL_DIR`는 실제 읽은 `SKILL.md`의 폴더를 뜻하는 설명용 표기다. 실행 시 절대 경로로 바꾼다. Windows에서는 한글 입출력을 위해 `python -X utf8`을 사용한다.

## 명령

```text
python -X utf8 SKILL_DIR/scripts/idea_bank.py init
python -X utf8 SKILL_DIR/scripts/idea_bank.py capture --input INPUT.json
python -X utf8 SKILL_DIR/scripts/idea_bank.py list --limit 20
python -X utf8 SKILL_DIR/scripts/idea_bank.py list --kind learning --status inbox
python -X utf8 SKILL_DIR/scripts/idea_bank.py search --query "회의록 할일" --match any --include-archived
python -X utf8 SKILL_DIR/scripts/idea_bank.py show IDEA_ID
python -X utf8 SKILL_DIR/scripts/idea_bank.py update IDEA_ID --input PATCH.json --expected-revision REVISION
```

공통 옵션 `--bank BANK_DIR`은 하위 명령 **앞에** 둔다. 저장소 위치는 `--bank`, 환경 변수 `IDEA_BANK_PATH`(절대 경로), 홈 폴더의 `idea-bank/` 순으로 정한다. `--bank`는 이번 실행만 덮어쓴다. 저장소를 영구히 옮길 때는 기존 기록 복사와 확인을 먼저 마친 뒤 `IDEA_BANK_PATH`를 바꾼다. Claude Code에서는 `~/.claude/settings.json`의 `env`에, 그 밖의 에이전트에서는 셸 환경 변수로 설정한다.

명령은 UTF-8 JSON을 출력한다. 실패는 `ok: false`와 0이 아닌 종료 코드로 표시된다. 성공 결과의 `path`를 실제 파일 링크로 사용한다. 입력 JSON 파일은 사용 가능한 임시 폴더에 UTF-8로 작성해 복잡한 쉘 인용을 피한다.

## 기록 입력

```json
{
  "original": "회의가 끝나면 회의록에서 내가 맡은 일만 뽑아주는 Agent가 있으면 좋겠다.",
  "title": "회의록에서 내 할 일을 추출하는 Agent",
  "summary": "회의록에서 본인에게 배정된 할 일을 찾아 정리한다.",
  "kind": "agent",
  "tags": ["회의", "업무"],
  "source": "사용자 메시지"
}
```

`original`만 필수다. 제목 생략 시 원문 첫 줄에서 만든다. 요약 기본값은 빈 문자열, 분류는 `other`, 태그는 빈 배열이다. `source`에는 실제 제공 경로만 적는다. 기록 입력에 없는 사실을 보충하지 않는다.

선택 항목 `assistant_note`는 짧은 AI 첨언이다. 본문의 `AI 첨언 (미검증 제안)` 섹션에 원문과 분리하여 저장된다. 요약은 원문에 충실한 정리로 유지하고 새로운 아이디어를 이 필드로 구분한다.

분류: `skill`, `agent`, `app`, `automation`, `learning`, `content`, `other`.

## 조회

- `list`와 `search`: `--status`, `--kind`, `--tag`, `--limit`, `--offset`, `--include-archived` 지원. 날짜 최신순이다. 전체 일치 수 `total`, 반환 목록 `ideas`, 추가 결과 여부 `has_more`를 출력한다.
- `search --query`: 공백으로 나눈 단어의 대소문자 무시 부분 문자열 검색. 기본 `--match all`, 넓은 후보 검색은 `any`. 검색 대상은 ID·제목·요약·분류·태그·원문·추가 메모다. 의미 검색이나 한국어 형태소 분석을 제공하지 않는다.
- `show`: 메타데이터, 문서 전체, `revision`을 반환한다. 연결된 다른 기록을 자동으로 읽지는 않는다.
- 조회는 빈 저장소를 생성하지 않는다. 기록 폴더 안에 손상된 카드가 있으면 건너뛰고 `warnings`를 출력한다. 이 경고가 있으면 완전한 검색 결과라고 표현하지 않는다. 수정 대상이 손상되면 수정은 실패한다.

## 수정 입력

```json
{
  "status": "exploring",
  "add_related_ids": ["IB-20261001-193000-12345678"],
  "note": "## 구체화\n문제: ...\n미확인: ...\n다음 행동: ..."
}
```

변경할 항목만 적는다. `title`, `summary`, `kind`, `tags`, `status`, `add_related_ids`, `note`를 지원한다. 태그는 교체, 관련 ID는 추가, 메모는 문서 끝에 날짜와 함께 추가한다. 원문 수정·카드 삭제는 지원하지 않는다. `add_related_ids`는 같은 저장소에 실제로 있는 ID만 허용한다.

`show`에서 받은 `revision`을 그대로 `--expected-revision`에 전달한다. 읽은 이후 문서가 변경되면 저장하지 않고 실패한다. 새 문서를 다시 읽고 의도한 변경을 재검토한다. 쓰기 잠금이 남아 있다면 실행 중인 쓰기가 있는지 확인한다. 원인을 확인하지 않고 잠금을 지우지 않는다.

## 파일 구조

```text
idea-bank/
  bank.json
  ideas/
    IB-날짜-시간-무작위ID.md
```

각 카드는 JSON 객체 형식의 YAML frontmatter와 Markdown 본문으로 구성된다. JSON은 YAML의 부분집합이므로 별도 YAML 라이브러리 없이 읽을 수 있다. 메타데이터에는 `schema_version`, `id`, `title`, `summary`, `kind`, `tags`, `status`, `created_at`, `updated_at`, `related_ids`, `source`가 들어간다. 날짜는 실행 환경의 시간대 오프셋을 포함하며, ID는 생성 시점과 무작위 접미사를 사용한다.

본문의 `원문`은 기록 당시 입력을 보존하고, 이후 내용은 날짜가 붙은 `추가 기록`으로 이어 붙인다. 직접 편집할 경우 frontmatter의 JSON 문법과 ID를 유지한다. 메모 본문은 일반 Markdown으로 편집할 수 있다.

은행의 카드 파일이 원본이다. 별도 검색 DB나 갱신이 필요한 색인은 만들지 않는다. 쓰기는 저장소 단위 잠금과 같은 폴더의 임시 파일 교체를 사용한다. 복수 카드에 대한 일괄 변경은 하나의 트랜잭션이 아니므로 성공한 카드와 실패한 카드를 각각 보고한다.
