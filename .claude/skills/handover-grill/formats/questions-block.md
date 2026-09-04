# 出力形式: handover-questions ブロック

前任者への確認が必要な事項が生じたら、回答の**末尾**に次のブロックを1つだけ付ける。
ブロック内は1行1件、`- [節ID] 質問文` の形式のみ。説明文を混ぜてはならない。
節IDは scope/outline/status/documents/budget/pending/planned/other のいずれか、
どれにも当たらなければ `-` と書く。

```handover-questions
- [budget] 令和6年度の繰越明許費 3件は、どの判断基準で「避け難い事故」としたか
- [pending] A社の交付決定取消（適正化法17条）は、いつまでに結論を出す必要があるか
```

質問がなければブロックを出力しない。1ターンに最大3問まで。
