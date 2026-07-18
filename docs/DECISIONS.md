# Decision Log

## Decision 001 — Establish AI Development OS

**Status:** Accepted

AI Development OS will be managed as a repository separate from Dream Fund Labs and validated through real work on Dream Fund Labs.

## Decision 002 — Human final authority with mandatory challenge

**Status:** Accepted

The CEO holds final authority. The PM and specialist reviewers must challenge decisions when evidence indicates Mission, Vision, quality, or safety risk. Dissent and the final rationale are recorded.

## Decision 003 — Agent and Reviewer separation

**Status:** Accepted

Each specialist function has an Agent that produces work and a Reviewer that evaluates it. Reviewers do not modify deliverables. Auditors are deferred until the simpler model has been validated.

## Decision 004 — GitHub as the single source of truth

**Status:** Accepted

Approved decisions, backlog status, role definitions, and workflows must be reflected in GitHub. Chat discussions are not authoritative until recorded.

<!-- ai-company-os-decision:issue-13 -->
## 2026-07-18 — Issue #13: READMEにv0.9の利用手順を追記する

**Status:** Accepted

**Source:** https://github.com/goz0813rmh-netizen/ai-development-os/issues/13

**CEO理由:** READMEへの利用手順追加として妥当

**承認した仮説:** なし

### Historian Record

CEO Decision  
PENDING  

正式な意思決定  
現時点でREADME v0.9追記内容はCEO未承認の仮説に依存しているため、正式承認は保留とする。README追記はベストエフォートの暫定版として扱い、QA・監査指摘の改善要望を反映後に改めてCEO承認を得る。  

理由  
- README追記のAPPROVEDフロー説明や対象範囲、表現方法などについてCEOの最終指示・承認がない。  
- QAおよびAuditより、第三者による初見理解・操作テストの具体計画不足、説明抽象化時の対応策未整備、リンク・構成チェック担当不明など品質保証体制の不備指摘がある。  
- 社内ドキュメントの一貫性確保およびユーザー誤解防止の観点から暫定版注釈の挿入も必須。  
- これら改善を公式運用とする計画策定および適切な試験実施後にCEO承認が相応しいため。  

保留・却下  
- README追記の最終承認（内容と表現）は保留。  
- QA指摘対応前の完了報告・承認は却下理由に該当。  
- 社内説明なく「承認無しの詳細仕様反映」は却下方針。  
- 品質担保がない状態での公開はリスクとして却下。  

未決事項  
- README追記に関するCEOの最終承認（内容・範囲・表現）。  
- 第三者初見理解テストの具体的実施計画と担当割当て。  
- 「説明が不明瞭」のフィードバック受付および対応フローの確立。  
- 既存README目次・構成整合性の検査具体方法と担当決定。  
- リンク切れ・用語統一の検証責任者の最終決定。  
- README暫定注釈文案の公式承認。  

次のアクション  
PM AgentはQAおよびAudit指摘に基づき以下を作成・調整し、CEOおよび関係者に提示せよ。  
1. 第三者による初見理解・操作テスト計画（対象者、タイミング、評価基準、フィードバック反映サイクル）詳細文書化。  
2. フィードバック受付窓口設置と「説明不明瞭時」の対応フロー整備。  
3. READMEの既存構成と目次の整合チェック具体手順と担当者割当。  
4. リンクチェックおよび用語説明検証担当を明確化。  
5. README内に暫定注釈を挿入し、現状ベストエフォートであることを利用者に通知する文面案を作成。  

改善計画完成・実施後再度CEO承認申請のため、README最終版公開とQA完了認定を目指す。  

記録先  
docs/DECISIONS.md
