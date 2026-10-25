use crate::error::InferError;
use crate::model::{CancelToken, Model, ModelInput, ModelOutput};
use doctor_core::types::ModelInfo;

pub struct ModelRegistry {
    loaded: Option<Box<dyn Model>>,
}

impl Default for ModelRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self { loaded: None }
    }

    /// Load a model into the registry (only one model can be active at a time).
    pub fn load(&mut self, model: Box<dyn Model>) -> Result<(), InferError> {
        if let Some(existing) = &mut self.loaded {
            existing.unload()?;
        }
        self.loaded = Some(model);
        Ok(())
    }

    /// Unload the currently loaded model.
    pub fn unload(&mut self) -> Result<(), InferError> {
        if let Some(mut existing) = self.loaded.take() {
            existing.unload()?;
        }
        Ok(())
    }

    /// Get current loaded model info.
    pub fn current_model_info(&self) -> Option<ModelInfo> {
        self.loaded.as_ref().map(|m| m.info().clone())
    }

    /// Run inference with the currently loaded model.
    pub fn run(
        &self,
        input: &ModelInput,
        cancel_token: &CancelToken,
    ) -> Result<ModelOutput, InferError> {
        match &self.loaded {
            Some(model) => model.run(input, cancel_token),
            None => Err(InferError::NotLoaded("no model currently loaded".into())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock::MockModel;

    #[test]
    fn registry_load_run_unload() {
        let mut reg = ModelRegistry::new();
        assert!(reg.current_model_info().is_none());

        reg.load(Box::new(MockModel::new())).unwrap();
        assert!(reg.current_model_info().is_some());

        let input = ModelInput {
            synthetic_image_ref: "test.png".into(),
            metadata: serde_json::Value::Null,
        };
        let out = reg.run(&input, &CancelToken::new()).unwrap();
        assert!(!out.findings.is_empty());

        reg.unload().unwrap();
        assert!(reg.current_model_info().is_none());
        assert!(reg.run(&input, &CancelToken::new()).is_err());
    }
}
