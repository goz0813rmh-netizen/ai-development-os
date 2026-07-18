# AI Development OS

AI Development OSは、人間とAIが協働し、より良い意思決定を積み重ねながら、高品質なプロダクトを継続的に開発するための運用基盤です。

最初の実証プロジェクトはDream Fund Labsです。

## Documentation

- [Company](docs/COMPANY.md)
- [Constitution](docs/CONSTITUTION.md)
- [Organization](docs/ORGANIZATION.md)
- [Workflow](docs/WORKFLOW.md)
- [Backlog](docs/BACKLOG.md)
- [Decision Log](docs/DECISIONS.md)
- [Agent definitions](docs/agents/README.md)


## 利用開始方法

### 1. /companyディレクトリの役割

/companyディレクトリは、AI Company OSの社内ドキュメントを格納する場所です。ここには会社の基本方針や規則、役割定義などが含まれ、全メンバーが参照します。主なファイル例として[COMPANY.md](docs/COMPANY.md)があります。

### 2. APPROVEDフローの概要

APPROVEDとは、CEOが最終的な承認を行った状態を指します。プルリクエスト（PR）は以下の流れで承認されます：

- AI Agentによる自動処理
- Reviewerによる確認
- PM Agentの最終チェック
- CEOによる最終承認（APPROVED）

このフローにより品質と方針の遵守が保証されます。APPROVEDの状態は、変更が公式に認められたことを意味します。

### 3. /implementディレクトリの説明

/implementディレクトリは実装計画やコードの変更を管理する場所です。ここにはEngineerが対応計画に基づき実装した成果物が含まれ、実際の開発作業が行われます。

### 4. プルリクエストの人間レビュー手順

プルリクエスト作成後の人間によるレビューは次のステップで進行します：

1. 自動チェックが完了後、担当Reviewerがコードを詳細に確認します。
2. PM Agentがレビュープロセス全体を監督し、課題がないかを確認します。
3. 最終的にCEOが承認判断（APPROVED）を下します。

このレビューは品質確保に不可欠であり、各役割がポイントを押さえて慎重に行います。

---
※ 本README追記内容は現時点でCEO・PMの最終承認待ちのため、暫定版（ベストエフォート記載）です。正式版では内容や表現を修正する可能性がありますのでご了承ください。
