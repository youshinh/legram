# Legram

Legram は、AI機能を搭載したプロフェッショナルグレードの3D LEDマトリックスシミュレーターです。CADのような操作感とダイナミックなデータ視覚化を提供します。

## 主な機能

- **3D LED マトリックス**: 高度な Three.js ベースの視覚化。
- **AI 統合**: Gemini を活用したインテリジェントな機能。
- **CAD コントロール**: 精密な操作が可能なインターフェース。
- **ダイナミック視覚化**: リアルタイムでのデータ反映。

## セットアップと実行

### 前提条件

- Node.js がインストールされていること。

### インストール手順

1. リポジトリをクローンし、依存関係をインストールします。
   ```bash
   npm install
   ```

2. `.env.local` ファイルを作成し、Gemini API キーを設定します。
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. アプリケーションを起動します。
   ```bash
   npm run dev
   ```

## 技術スタック

- React 19
- TypeScript
- Three.js (@react-three/fiber, @react-three/drei)
- Google GenAI SDK
- Vite

## ライセンス

[MIT License](LICENSE)
