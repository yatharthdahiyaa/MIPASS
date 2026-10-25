use infer::{read_frame, send_host_msg, write_frame, HostMessage, WorkerMessage};
use std::process::Stdio;
use tokio::io::BufReader;
use tokio::process::Command;

#[tokio::test]
async fn test_worker_ipc_cycle_and_malformed_input() {
    // Locate the built infer-worker binary or build it
    let status = Command::new("cargo")
        .args(["build", "-p", "infer-worker", "--bin", "infer-worker"])
        .current_dir("../../")
        .status()
        .await;

    // If running in local tests directory
    let worker_bin = if std::path::Path::new("../../target/debug/infer-worker.exe").exists() {
        "../../target/debug/infer-worker.exe"
    } else {
        "target/debug/infer-worker.exe"
    };

    if !std::path::Path::new(worker_bin).exists() && status.is_err() {
        return; // skip if cargo build not invocable from test runner
    }

    let mut child = match Command::new(worker_bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return,
    };

    let mut stdin = child.stdin.take().expect("child stdin");
    let mut stdout = BufReader::new(child.stdout.take().expect("child stdout"));

    // 1. Send Ping -> expect Pong
    send_host_msg(&mut stdin, &HostMessage::Ping).await.unwrap();
    let resp = read_frame(&mut stdout).await.unwrap();
    let msg: WorkerMessage = serde_json::from_slice(&resp).unwrap();
    assert_eq!(msg, WorkerMessage::Pong);

    // 2. Send Load mock-cxr
    send_host_msg(
        &mut stdin,
        &HostMessage::Load {
            model_id: "mock-cxr".into(),
            bundle_path: None,
        },
    )
    .await
    .unwrap();
    let resp = read_frame(&mut stdout).await.unwrap();
    let msg: WorkerMessage = serde_json::from_slice(&resp).unwrap();
    assert!(matches!(msg, WorkerMessage::Loaded { .. }));

    // 3. Send Run -> expect Result
    let input = infer::ModelInput {
        synthetic_image_ref: "ipc_test_image.png".into(),
        metadata: serde_json::json!({ "case_id": "test" }),
    };
    send_host_msg(
        &mut stdin,
        &HostMessage::Run {
            request_id: "req-123".into(),
            input,
        },
    )
    .await
    .unwrap();
    let resp = read_frame(&mut stdout).await.unwrap();
    let msg: WorkerMessage = serde_json::from_slice(&resp).unwrap();
    match msg {
        WorkerMessage::Result { request_id, output } => {
            assert_eq!(request_id, "req-123");
            assert!(!output.findings.is_empty());
        }
        other => panic!("expected WorkerMessage::Result, got {other:?}"),
    }

    // 4. Send malformed JSON -> worker must NOT crash, returns Error
    write_frame(&mut stdin, b"{ invalid json ").await.unwrap();
    let resp = read_frame(&mut stdout).await.unwrap();
    let msg: WorkerMessage = serde_json::from_slice(&resp).unwrap();
    assert!(matches!(msg, WorkerMessage::Error { .. }));

    // 5. Worker is still responsive: Send Ping -> expect Pong
    send_host_msg(&mut stdin, &HostMessage::Ping).await.unwrap();
    let resp = read_frame(&mut stdout).await.unwrap();
    let msg: WorkerMessage = serde_json::from_slice(&resp).unwrap();
    assert_eq!(msg, WorkerMessage::Pong);

    // 6. Send Unload -> expect Unloaded
    send_host_msg(&mut stdin, &HostMessage::Unload)
        .await
        .unwrap();
    let resp = read_frame(&mut stdout).await.unwrap();
    let msg: WorkerMessage = serde_json::from_slice(&resp).unwrap();
    assert_eq!(msg, WorkerMessage::Unloaded);

    // Terminate worker
    let _ = child.kill().await;
}
