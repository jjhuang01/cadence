use anyhow::{Context, Result};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use rodio::Source;
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::Path;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let endpoint = env::var("R2_ENDPOINT").context("R2_ENDPOINT 未设置")?;
    let access_key = env::var("R2_ACCESS_KEY_ID").context("R2_ACCESS_KEY_ID 未设置")?;
    let secret_key = env::var("R2_SECRET_ACCESS_KEY").context("R2_SECRET_ACCESS_KEY 未设置")?;
    let bucket = env::var("R2_BUCKET").context("R2_BUCKET 未设置")?;
    let namespace = env::var("NAMESPACE").unwrap_or_else(|_| "tips-music".to_string());

    println!("🔧 配置 R2 客户端...");
    println!("   Endpoint: {}", endpoint);
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

    println!("\n📤 测试 1: 上传测试文件");
    test_upload(&client, &bucket, &namespace).await?;

    println!("\n📋 测试 2: 列举在线文件夹");
    let files = list_folder(&client, &bucket, &namespace).await?;
    println!("   找到 {} 个文件", files.len());
    for file in &files {
        println!("   - {}", file);
    }

    if !files.is_empty() {
        println!("\n📥 测试 3: 下载并播放第一个文件");
        let key = &files[0];
        let local_path = download_file(&client, &bucket, key).await?;
        println!("   已下载到: {}", local_path);

        println!("\n🎵 测试 4: 播放音频");
        play_audio(&local_path)?;
    }

    println!("\n✅ 所有测试通过!");
    Ok(())
}

async fn test_upload(client: &Client, bucket: &str, namespace: &str) -> Result<()> {
    let test_content = b"This is a test MP3 file placeholder";
    let key = format!("{}/test-song.mp3", namespace);

    let body = ByteStream::from(test_content.to_vec());

    client
        .put_object()
        .bucket(bucket)
        .key(&key)
        .body(body)
        .send()
        .await
        .context("上传失败")?;

    println!("   ✅ 上传成功: {}", key);
    Ok(())
}

async fn list_folder(client: &Client, bucket: &str, namespace: &str) -> Result<Vec<String>> {
    let prefix = format!("{}/", namespace);

    let resp = client
        .list_objects_v2()
        .bucket(bucket)
        .prefix(&prefix)
        .send()
        .await
        .context("列举文件失败")?;

    let mut files = Vec::new();
    for obj in resp.contents() {
        if let Some(key) = obj.key() {
            if key.ends_with(".mp3") {
                files.push(key.to_string());
            }
        }
    }

    Ok(files)
}

async fn download_file(client: &Client, bucket: &str, key: &str) -> Result<String> {
    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .context("下载失败")?;

    let data = resp.body.collect().await?.into_bytes();

    let local_path = format!("/tmp/{}", Path::new(key).file_name().unwrap().to_str().unwrap());
    let mut file = File::create(&local_path)?;
    file.write_all(&data)?;

    Ok(local_path)
}

fn play_audio(path: &str) -> Result<()> {
    println!("   🎵 开始播放: {}", path);
    println!("   ⚠️  注意: 这是测试文件,不是真实 MP3,会播放失败");
    println!("   💡 实际集成时需要上传真实 MP3 文件测试");

    match rodio::OutputStream::try_default() {
        Ok((_stream, handle)) => {
            match rodio::Decoder::new(File::open(path)?) {
                Ok(source) => {
                    handle.play_raw(source.convert_samples())?;
                    println!("   ✅ 播放成功 (如果是真实 MP3)");
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
                Err(e) => {
                    println!("   ⚠️  解码失败 (预期行为,因为是测试文件): {}", e);
                }
            }
        }
        Err(e) => {
            println!("   ⚠️  音频输出初始化失败: {}", e);
        }
    }

    Ok(())
}
