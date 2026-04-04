use anyhow::{Context, Result};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use std::env;
use std::path::Path;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("用法: cargo run --bin upload_real_mp3 <MP3文件路径>");
        eprintln!("示例: cargo run --bin upload_real_mp3 ~/Music/song.mp3");
        std::process::exit(1);
    }

    let file_path = &args[1];
    let path = Path::new(file_path);

    if !path.exists() {
        eprintln!("❌ 文件不存在: {}", file_path);
        std::process::exit(1);
    }

    if !file_path.ends_with(".mp3") {
        eprintln!("⚠️  警告: 文件不是 .mp3 格式");
    }

    let endpoint = env::var("R2_ENDPOINT").context("R2_ENDPOINT 未设置")?;
    let access_key = env::var("R2_ACCESS_KEY_ID").context("R2_ACCESS_KEY_ID 未设置")?;
    let secret_key = env::var("R2_SECRET_ACCESS_KEY").context("R2_SECRET_ACCESS_KEY 未设置")?;
    let bucket = env::var("R2_BUCKET").context("R2_BUCKET 未设置")?;
    let namespace = env::var("NAMESPACE").unwrap_or_else(|_| "tips-music".to_string());

    println!("🔧 配置 R2 客户端...");
    println!("   Bucket: {}", bucket);
    println!("   Namespace: {}", namespace);

    let creds = aws_sdk_s3::config::Credentials::new(
        access_key,
        secret_key,
        None,
        None,
        "r2-static",
    );

    let config = aws_sdk_s3::Config::builder()
        .endpoint_url(&endpoint)
        .credentials_provider(creds)
        .region(aws_sdk_s3::config::Region::new("auto"))
        .behavior_version_latest()
        .build();

    let client = Client::from_conf(config);

    let file_name = path
        .file_name()
        .context("无效的文件路径")?
        .to_str()
        .context("文件名包含非 UTF-8 字符")?;

    let key = format!("{}/{}", namespace, file_name);

    println!("\n📤 上传文件...");
    println!("   本地: {}", file_path);
    println!("   云端: {}", key);

    let body = ByteStream::from_path(path)
        .await
        .context("读取文件失败")?;

    client
        .put_object()
        .bucket(&bucket)
        .key(&key)
        .body(body)
        .send()
        .await
        .context("上传失败")?;

    println!("\n✅ 上传成功!");
    println!("   Key: {}", key);
    println!("\n💡 现在可以在 Tips 播放器中点击 '☁️ Scan Cloud' 来加载这个文件");

    Ok(())
}
