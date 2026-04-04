#!/bin/bash
set -e

MUSIC_DIR="/Users/os/Downloads/classic_songs"
UPLOAD_BIN="./target/debug/upload_real_mp3"

echo "🎵 批量上传 MP3 文件到 R2"
echo "================================"

# 编译上传工具
echo "📦 编译上传工具..."
cd /Users/os/Desktop/code/self/tips
cargo build --bin upload_real_mp3

echo ""
echo "📤 开始上传..."
count=0
total=$(find "$MUSIC_DIR" -name "*.mp3" -type f | wc -l | tr -d ' ')

find "$MUSIC_DIR" -name "*.mp3" -type f | while read -r file; do
    count=$((count + 1))
    echo ""
    echo "[$count/$total] 上传: $(basename "$file")"
    "$UPLOAD_BIN" "$file" || echo "⚠️  上传失败，继续下一个..."
done

echo ""
echo "✅ 批量上传完成！"
echo "💡 现在可以运行: cargo run --bin tips"
