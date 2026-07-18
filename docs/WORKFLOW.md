# Workflow

1. Discovery
2. Issue AnalyzerによるIssue Brief作成
3. Plannerによる優先順位・完了条件の定義
4. Architectによる最小変更方針の設計
5. Engineerによる実装計画の作成
6. QAによる品質保証
7. Auditorによる独立監査
8. CEO Review
9. Historianによる意思決定記録の整形
10. GitHub更新とDone

## CEO Review states

- `APPROVED`: 承認範囲を正式記録と次工程へ進める
- `REVISE`: 修正要求を付けて再検討へ戻す
- `REJECTED`: 却下理由を記録し、実装・正式記録を止める

CEOの回答は `docs/agents/CEO_REVIEW.md` の形式に従う。曖昧な肯定は正式承認として扱わない。

## Historian recording rules

- `APPROVED`の内容だけを正式な意思決定として扱う
- `REVISE`では修正要求を次のアクションとして残す
- `REJECTED`では却下理由と選択肢を残す
- CEO未回答または形式不備は`PENDING`として扱う
- CEOが明示していない仮説は承認済みとみなさない

## Operating rules

- Discovery and Build are distinct modes.
- Work is kept small enough for a short human review.
- Review findings include severity, rationale, and recommended action.
- A red-level concern requires the PM to recommend pausing, but the CEO retains final authority.
- Suggestions outside the approved task are recorded separately and are not implemented automatically.
- 正式記録の自動更新は、CEOの`APPROVED`を確認した後にのみ実行する。
