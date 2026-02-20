# cc-config

Claude Code の設定体系をノードグラフで可視化するデスクトップアプリ。

## 技術スタック

- Tauri 2 + React + TypeScript + Vite
- @xyflow/react (React Flow v12)
- @tauri-apps/plugin-fs + @tauri-apps/plugin-dialog
- Tailwind CSS v4
- pnpm

## ディレクトリ構成

- `src/types/` — ドメイン型、グラフ型
- `src/constants/` — スコープ別色定義
- `src/lib/` — scanner, parser, reference-resolver, graph-builder
- `src/components/` — UIコンポーネント（layout, graph, preview）
- `src/hooks/` — React hooks
- `src-tauri/` — Tauri Rust バックエンド

## 開発コマンド

```bash
pnpm tauri dev    # 開発サーバー起動
pnpm tauri build  # プロダクションビルド
```

## 設計判断

- Rust カスタムコマンド不要（ファイル読取りは JS API で完結）
- レイアウトは手動計算（ノード数 20-30 程度なので dagre/elk 不要）
- 状態管理は useState + props（必要になったら zustand 導入）
