//! HTTP client for the MIPAAS Flask API. Only this module talks to the network;
//! the webview reaches it exclusively through the Tauri commands in `commands.rs`.

use std::time::Duration;

use reqwest::{multipart, Method, StatusCode};
use serde_json::Value;
use url::Url;

use crate::error::{AppError, AppResult};

pub struct Api {
    http: reqwest::Client,
}

impl Api {
    pub fn new() -> AppResult<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("MIPAAS-Desktop/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(5))
            // X-ray analysis runs synchronously on the server; first model load can take a while.
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(Api { http })
    }

    fn url(base: &Url, path: &str) -> AppResult<Url> {
        base.join(&format!("api/v1/{}", path.trim_start_matches('/')))
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    fn unreachable(base: &Url) -> AppError {
        AppError::Unreachable(base.as_str().trim_end_matches('/').to_string())
    }

    /// Sends a request and unwraps the backend's `{ success, data | error }` envelope.
    pub async fn json(
        &self,
        base: &Url,
        token: Option<&str>,
        method: Method,
        path: &str,
        body: Option<&Value>,
    ) -> AppResult<Value> {
        let mut req = self.http.request(method, Self::url(base, path)?);
        if let Some(t) = token {
            req = req.bearer_auth(t);
        }
        if let Some(b) = body {
            req = req.json(b);
        }
        let res = req.send().await.map_err(|_| Self::unreachable(base))?;
        Self::envelope(res, token.is_some()).await
    }

    pub async fn upload(
        &self,
        base: &Url,
        token: &str,
        path: &str,
        form: multipart::Form,
    ) -> AppResult<Value> {
        let res = self
            .http
            .post(Self::url(base, path)?)
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    AppError::Server("The analysis took too long. Please try again.".into())
                } else {
                    Self::unreachable(base)
                }
            })?;
        Self::envelope(res, true).await
    }

    /// `GET /api/v1/health` -> Some(version) only if the server identifies itself as the MIPAAS API.
    pub async fn health(&self, base: &Url) -> Option<String> {
        let res = self
            .http
            .get(Self::url(base, "health").ok()?)
            .timeout(Duration::from_secs(4))
            .send()
            .await
            .ok()?;
        let v: Value = res.json().await.ok()?;
        (v.get("service").and_then(Value::as_str) == Some("mipaas-api")).then(|| {
            v.get("version")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string()
        })
    }

    /// Fetches binary content (images, shared documents). Returns (content-type, bytes).
    pub async fn bytes(&self, base: &Url, token: &str, path: &str) -> AppResult<(String, Vec<u8>)> {
        let res = self
            .http
            .get(Self::url(base, path)?)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|_| Self::unreachable(base))?;
        let status = res.status();
        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::SessionExpired);
        }
        if !status.is_success() {
            return Err(AppError::Server("That file isn't available.".into()));
        }
        let ctype = res
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_string();
        let body = res.bytes().await.map_err(|_| Self::unreachable(base))?;
        Ok((ctype, body.to_vec()))
    }

    async fn envelope(res: reqwest::Response, authenticated: bool) -> AppResult<Value> {
        let status = res.status();
        let body: Option<Value> = res.json().await.ok();
        if status == StatusCode::UNAUTHORIZED && authenticated {
            return Err(AppError::SessionExpired);
        }
        match body {
            Some(v)
                if v.get("success").and_then(Value::as_bool) == Some(true)
                    && status.is_success() =>
            {
                Ok(v.get("data").cloned().unwrap_or(Value::Null))
            }
            Some(v) => {
                let msg = v
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .unwrap_or("The server rejected the request.")
                    .to_string();
                Err(AppError::Server(msg))
            }
            None => Err(AppError::Server(format!(
                "The server returned an unexpected response (HTTP {}). Is this a MIPAAS server?",
                status.as_u16()
            ))),
        }
    }
}
