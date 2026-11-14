//! End-to-end check of the Rust HTTP layer against a running MIPAAS backend.
//! Ignored by default. Run with:
//!   MIPAAS_E2E_SERVER=http://127.0.0.1:8092 MIPAAS_E2E_EMAIL=... MIPAAS_E2E_PASSWORD=... \
//!   MIPAAS_E2E_XRAY=../../../data/samples/sample_cxr.dcm cargo test e2e -- --ignored

use reqwest::{multipart, Method};
use serde_json::{json, Value};

use crate::{api::Api, config::normalize_server, error::AppError};

fn env(k: &str) -> String {
    std::env::var(k).unwrap_or_else(|_| panic!("set {k}"))
}

#[test]
#[ignore]
fn e2e_doctor_flow() {
    tauri::async_runtime::block_on(async {
        let base = normalize_server(&env("MIPAAS_E2E_SERVER")).unwrap();
        let api = Api::new().unwrap();

        assert!(
            api.health(&base).await.is_some(),
            "server is not a MIPAAS API"
        );

        // Wrong password -> server message, not a crash.
        let bad = api
            .json(&base, None, Method::POST, "auth/login", Some(&json!({"identifier": env("MIPAAS_E2E_EMAIL"), "password": "nope-nope-1", "client": "desktop"})))
            .await;
        assert!(matches!(bad, Err(AppError::Server(_))));

        let login = api
            .json(&base, None, Method::POST, "auth/login", Some(&json!({"identifier": env("MIPAAS_E2E_EMAIL"), "password": env("MIPAAS_E2E_PASSWORD"), "client": "desktop"})))
            .await
            .unwrap();
        let token = login["token"].as_str().unwrap().to_string();

        let bytes = std::fs::read(env("MIPAAS_E2E_XRAY")).unwrap();
        let form = multipart::Form::new()
            .part("file", multipart::Part::bytes(bytes).file_name("chest.dcm"))
            .text("patient_ref", "E2E-001")
            .text("patient_age", "47");
        let up = api
            .upload(&base, &token, "doctor/studies", form)
            .await
            .unwrap();
        let study = &up["study"];
        let id = study["id"].as_str().unwrap().to_string();
        assert_eq!(study["status"], "completed");
        assert_eq!(study["patient_ref"], "E2E-001");

        let (ctype, png) = api
            .bytes(
                &base,
                &token,
                &format!("doctor/studies/{id}/image?kind=heatmap"),
            )
            .await
            .unwrap();
        assert_eq!(ctype, "image/png");
        assert!(png.starts_with(b"\x89PNG"));

        let patched = api
            .json(
                &base,
                Some(&token),
                Method::PATCH,
                &format!("doctor/studies/{id}"),
                Some(&json!({"impression": "E2E impression."})),
            )
            .await
            .unwrap();
        assert_eq!(patched["study"]["impression"], "E2E impression.");

        let signed = api
            .json(
                &base,
                Some(&token),
                Method::POST,
                &format!("doctor/studies/{id}/sign"),
                None,
            )
            .await
            .unwrap();
        assert_eq!(signed["study"]["report_status"], "signed");

        let list: Value = api
            .json(
                &base,
                Some(&token),
                Method::GET,
                "doctor/studies?filter=signed",
                None,
            )
            .await
            .unwrap();
        assert!(list["studies"]
            .as_array()
            .unwrap()
            .iter()
            .any(|s| s["id"] == id.as_str()));

        api.json(&base, Some(&token), Method::POST, "auth/logout", None)
            .await
            .unwrap();
        let after = api
            .json(&base, Some(&token), Method::GET, "doctor/summary", None)
            .await;
        assert!(
            matches!(after, Err(AppError::SessionExpired)),
            "token must be revoked after logout"
        );
    });
}
